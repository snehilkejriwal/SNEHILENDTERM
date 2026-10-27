// Reads common Indian ticket, airline-message, payslip and settlement layouts with plain patterns.
// Runs on every upload, needs no API key, and only fills what it actually finds.
// The AI reader (if configured) then fills whatever is still empty.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_RE = new RegExp(
  `(\\d{1,2})\\s*[- ]?\\s*${MON}\\.?,?\\s*[- ]?\\s*(\\d{4})` + // 10 Sep 2026, 10-Sep-2026
  `|(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})` + // 10-09-2026, 10/09/2026
  `|(\\d{4})-(\\d{2})-(\\d{2})`, // 2026-09-10
  'i'
);
const TIME_RE = /(\d{1,2})[:.](\d{2})\s*(am|pm|hrs?)?/i;

const pad = (n) => String(n).padStart(2, '0');
const money = (s) => Number(String(s).replace(/,/g, ''));

// Indian documents are almost always dd-mm-yyyy and IST.
export function parseDate(str) {
  const m = DATE_RE.exec(str || '');
  if (!m) return null;
  let d; let mo; let y;
  if (m[1]) { d = +m[1]; mo = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)]; y = +m[3]; }
  else if (m[4]) { d = +m[4]; mo = +m[5] - 1; y = +m[6]; }
  else { y = +m[7]; mo = +m[8] - 1; d = +m[9]; }
  if (mo === undefined || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return { y, mo, d, index: m.index, length: m[0].length };
}

export function parseTime(str) {
  const m = TIME_RE.exec(str || '');
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, min };
}

const isoDate = ({ y, mo, d }) => `${y}-${pad(mo + 1)}-${pad(d)}`;
const isoDateTime = (date, time) => `${isoDate(date)}T${pad(time.h)}:${pad(time.min)}:00+05:30`;

// Text right after a label, on the same line.
function after(text, labelRe) {
  const re = new RegExp(`(?:${labelRe.source})\\s*[:\\-–]?\\s*([^\\n]*)`, 'i');
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

function amountAfter(text, labelRe) {
  const re = new RegExp(`(?:${labelRe.source})[^\\n\\d₹]{0,40}?(?:Rs\\.?|INR|₹)\\s*([\\d,]+(?:\\.\\d+)?)`, 'im');
  const m = re.exec(text);
  return m ? money(m[1]) : undefined;
}

function dateAfter(text, labelRe) {
  const s = after(text, labelRe);
  const d = s && parseDate(s);
  return d ? isoDate(d) : undefined;
}

function dateTimeAfter(text, labelRe) {
  const s = after(text, labelRe);
  if (!s) return undefined;
  const d = parseDate(s);
  if (!d) return undefined;
  const t = parseTime(s.slice(d.index + d.length)) || parseTime(s);
  return t ? isoDateTime(d, t) : undefined;
}

const AIRLINES = ['Air India Express', 'Air India', 'IndiGo', 'Akasa Air', 'SpiceJet', 'Vistara', 'Alliance Air', 'Star Air', 'Fly91', 'Emirates', 'Qatar Airways', 'Etihad Airways', 'Singapore Airlines'];

function extractFlight(text, flat) {
  const f = {};
  const pnr = /\b(?:PNR|booking reference|booking ref\.?|confirmation code)\s*(?:no\.?|number)?\s*[:#\-]?\s*([A-Z0-9]{6})\b/i.exec(flat);
  if (pnr) f.pnr = pnr[1].toUpperCase();
  const flightNo = /\bflight\s*(?:no\.?|number)?\s*[:#\-]?\s*([A-Z0-9]{2})\s?-?\s?(\d{2,4})\b/i.exec(flat);
  if (flightNo) f.flightNumber = `${flightNo[1].toUpperCase()} ${flightNo[2]}`;

  const known = AIRLINES.find((a) => flat.toLowerCase().includes(a.toLowerCase()));
  const generic = /\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?\s(?:Airways|Airlines|Air))\b/.exec(flat) || /\b([A-Z][a-z]+[A-Z][a-z]+)(?=\s*:\s*E-?Ticket|\s+E-?Ticket)/.exec(text);
  if (known || generic) f.airline = known || generic[1];

  const passenger = /\b(?:Passenger(?: name)?|Traveller(?: name)?)[ \t]*[:\-]?[ \t]*((?:Mr|Ms|Mrs|Dr)\.? )?([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})/.exec(text);
  const dear = /\bDear[ \t]+((?:Mr|Ms|Mrs)\.? )?([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})[ \t]*,/.exec(text);
  if (passenger || dear) f.passengerName = (passenger || dear)[2];

  const from = /\bFrom\s*[:\-]?\s*([A-Z][A-Za-z .]+?)\s*\(([A-Z]{3})\)/.exec(text);
  const to = /\bTo\s*[:\-]?\s*([A-Z][A-Za-z .]+?)\s*\(([A-Z]{3})\)/.exec(text);
  if (from) f.origin = `${from[1].trim()} (${from[2]})`;
  if (to) f.destination = `${to[1].trim()} (${to[2]})`;

  // What happened: denied boarding beats cancellation beats delay.
  if (/denied boarding|offloaded|overbook/i.test(flat)) f.incidentType = 'denied_boarding';
  else if (/\bcancel(?:l)?ed\b|cancellation/i.test(flat)) f.incidentType = 'cancellation';
  else if (/\bdelay(?:ed)?\b|revised departure|rescheduled/i.test(flat)) f.incidentType = 'delay';

  f.scheduledDeparture = dateTimeAfter(text, /scheduled departure|departure date(?:\s*&\s*time)?|departs?(?:\s*on)?/);

  const dur = after(text, /(?:scheduled\s+)?(?:flight\s+)?duration|block time|travel time/);
  if (dur) {
    const mins = /\((\d{2,3})\s*min/i.exec(dur);
    const hm = /(\d{1,2})\s*h(?:rs?|ours?)?\s*(\d{1,2})?\s*m?/i.exec(dur);
    if (mins) f.blockTimeMinutes = +mins[1];
    else if (hm) f.blockTimeMinutes = +hm[1] * 60 + (+hm[2] || 0);
  }

  // When the airline told you: the date on the email or SMS itself.
  if (f.incidentType === 'cancellation') f.notifiedAt = dateTimeAfter(text, /\b(?:sent|received)(?: on)?\b/);

  // Delay: a revised time on the same day as the scheduled departure.
  const revised = /(?:revised|new|actual|expected)\s+departure(?:\s*time)?\s*[:\-]?\s*([^\n]{0,40})/i.exec(flat);
  if (revised && f.scheduledDeparture) {
    const d = parseDate(revised[1]);
    const t = parseTime(revised[1]);
    if (t) f.actualDeparture = isoDateTime(d || parseDate(f.scheduledDeparture), t);
  }

  if (/(unable to|could not|cannot|did not)\s+(offer|provide|arrange)\s+(an?\s+)?alternat/i.test(flat)) f.alternateOffered = false;
  else if (/(rebooked|re-booked|alternate flight (has been|was) (offered|booked|arranged))/i.test(flat)) f.alternateOffered = true;
  if (/no (meals|refreshments|food)/i.test(flat)) f.mealsProvided = false;
  else if (/(meals?|refreshments?|vouchers?) (were|was) (provided|given|served)/i.test(flat)) f.mealsProvided = true;
  if (/I (took|boarded|travel(?:l)?ed on) the (delayed )?flight/i.test(flat)) f.travelled = true;
  if (/weather|fog|cyclone|air traffic control|ATC restriction|security alert|strike/i.test(flat)) f.extraordinaryCircumstances = true;

  f.basicFare = amountAfter(text, /basic fare|base fare/);
  f.fuelCharge = amountAfter(text, /fuel (?:charge|surcharge)|\bYQ\b/);
  f.ticketTotal = amountAfter(text, /^total(?:\s*(?:fare|amount|price))?|grand total|amount paid|total paid/m);
  const refund = /refund of\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i.exec(flat);
  if (refund) f.refundReceived = money(refund[1]);
  return f;
}

function extractEmployment(text, flat) {
  const f = {};
  const company = /\b([A-Z][A-Za-z&.]*(?:\s[A-Z][A-Za-z&.]*){0,5}\s(?:Private Limited|Pvt\.?\s?Ltd\.?|Limited|LLP))\b/i.exec(text);
  if (company) f.employerName = company[1].replace(/\s+/g, ' ').replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());

  const emp = /\b(?:Employee(?: name)?|Name of (?:the )?employee)[ \t]*[:\-]?[ \t]*([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})/.exec(text);
  const to = /\bTo[ \t]*[:\-]?[ \t]*(?:Mr|Ms|Mrs|Dr)\.?[ \t]+([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})/.exec(text);
  if (emp || to) f.employeeName = (emp || to)[1];

  const desig = /\b(?:Designation\s*[:\-]?\s*|appoint you as\s+)([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,3})/.exec(flat);
  if (desig) f.designation = desig[1];

  if (/fixed[-\s]term/i.test(flat)) f.employmentType = 'fixed_term';
  else if (/\bpermanent\b/i.test(flat)) f.employmentType = 'permanent';

  const reason = after(text, /reason for (?:exit|leaving|separation)|mode of separation|separation type/);
  const r = (reason || '').toLowerCase();
  if (r.includes('resign')) f.separationType = 'resignation';
  else if (r.includes('retrench') || r.includes('layoff') || r.includes('lay-off')) f.separationType = 'retrenchment';
  else if (r.includes('terminat')) f.separationType = 'termination';
  else if (r.includes('contract')) f.separationType = 'end_of_contract';

  f.joiningDate = dateAfter(text, /date of joining|joining date|\bDOJ\b/) || (() => {
    const m = /with effect from\s+([^\n]{0,25}\n?[^\n]{0,10})/i.exec(text);
    const d = m && parseDate(m[1].replace(/\n/g, ' '));
    return d ? isoDate(d) : undefined;
  })();
  f.lastWorkingDate = dateAfter(text, /last working (?:day|date)|\bLWD\b|date of relieving|relieving date/);

  f.monthlyBasic = amountAfter(flat, /basic (?:salary|pay)(?: is)?|^basic/m);
  f.monthlyGross = amountAfter(flat, /gross (?:earnings|salary|pay)(?: is)?/);

  const leave = /(?:earned leave balance|leave balance|EL balance)\s*[:\-]?\s*(\d{1,3})\s*days?/i.exec(flat);
  if (leave) f.earnedLeaveBalance = +leave[1];
  if (/leave is not encashable|no leave encashment/i.test(flat)) f.leaveEncashable = false;
  else if (/leave is encashable|leave encashment is (allowed|payable)/i.test(flat)) f.leaveEncashable = true;

  const notice = /notice period as per (?:contract|policy)\s*[:\-]?\s*(\d{1,3})\s*days/i.exec(flat) || /giving\s+(\d{1,3})\s+days(?:'|’)?\s+(?:written\s+)?notice/i.exec(flat);
  if (notice) f.noticePeriodDays = +notice[1];
  const served = /notice period served\s*[:\-]?\s*(\d{1,3})\s*days/i.exec(flat);
  if (served) f.noticeServedDays = +served[1];
  f.noticeRecoveryDeducted = amountAfter(flat, /notice (?:period )?(?:recovery|pay recovery|shortfall)/);
  f.offeredAmount = amountAfter(flat, /net (?:amount )?payable|net settlement amount|total payable|final settlement amount/);

  // Unpaid salary days: add up the "(N days)" on each salary line of a settlement statement.
  const days = [...text.matchAll(/salary for[^\n]*?\((?:unpaid,?\s*)?(\d{1,3})\s*days?\)/gi)].reduce((s, m) => s + +m[1], 0);
  if (days) f.pendingSalaryDays = days;

  if (/gratuity\s*[:\-]?\s*(not applicable|nil|n\/a|-|0\b)/i.test(flat)) f.gratuityIncludedInOffer = false;
  else if (/gratuity\s*[:\-]?\s*(?:Rs\.?|INR|₹)\s*[\d,]+/i.test(flat)) f.gratuityIncludedInOffer = true;

  if (/non[-\s]?compete|shall not (take up employment|join|work) with any competitor|restrictive covenant/i.test(flat)) f.hasNonCompete = true;
  if (/(retain|hold|keep)[^.]{0,40}original (certificates|documents)/i.test(flat)) f.certificatesWithheld = true;
  return f;
}

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, six: 6, fifteen: 15, thirty: 30, sixty: 60, ninety: 90 };
const toNum = (w) => (/^\d+$/.test(w) ? +w : WORD_NUM[w.toLowerCase()]);
// Words in a name are joined by spaces only, so a name never runs on to the next line.
const PERSON = '(?:(?:Mr|Ms|Mrs|Dr|Shri|Smt)\\.?[ \\t]+)?([A-Z][a-z]+(?:[ \\t][A-Z][a-z]+){1,3})';

// Rental agreements and landlord messages (WhatsApp, email).
function extractRent(text, flat) {
  const f = {};
  const rent = /monthly rent\s*(?:of|is|:|amount)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i.exec(flat) || /rent of\s*(?:Rs\.?|INR|₹)\s*([\d,]+)\s*(?:\/-\s*)?(?:per month|a month|monthly)/i.exec(flat);
  if (rent) f.monthlyRent = money(rent[1]);
  const deposit = /(?:security|refundable|interest[-\s]free)\s+deposit\s*(?:of|is|:|amount)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i.exec(flat);
  if (deposit) f.depositPaid = money(deposit[1]);

  // "one month's notice", "30 days' notice", "2 months prior written notice"
  const notice = /\b(\d{1,3}|one|two|three|four|six|fifteen|thirty|sixty|ninety)\s*(days?|months?)(?:['’]s?)?\s+(?:(?:prior|advance|written)\s+)*notice/i.exec(flat);
  if (notice && toNum(notice[1])) f.agreementNoticeDays = toNum(notice[1]) * (/month/i.test(notice[2]) ? 30 : 1);
  const refundDays = /refund(?:ed|able)?\b[^.]{0,120}?\bwithin\s+(\d{1,3}|fifteen|thirty|sixty|ninety)\s*days/i.exec(flat);
  if (refundDays && toNum(refundDays[1])) f.agreementRefundDays = toNum(refundDays[1]);

  // Parties: "Landlord: X" / "Tenant: Y", or "between X (... Landlord) and Y (... Tenant)".
  const landlord = new RegExp(`\\b(?:Landlord|Owner|Lessor)\\s*(?:name)?\\s*[:\\-]\\s*${PERSON}`).exec(text);
  const tenant = new RegExp(`\\b(?:Tenant|Lessee)\\s*(?:name)?\\s*[:\\-]\\s*${PERSON}`).exec(text);
  if (landlord) f.landlordName = landlord[1];
  if (tenant) f.tenantName = tenant[1];
  const between = new RegExp(`\\bbetween\\s+${PERSON}([\\s\\S]{0,160}?)\\band\\s+${PERSON}`).exec(flat);
  if (between) {
    // Whoever is called the Tenant/Lessee in the gap after the first name is the tenant.
    const firstIsTenant = /\b(tenant|lessee)\b/i.test(between[2]) && !/\b(landlord|owner|lessor)\b/i.test(between[2]);
    const [l, t] = firstIsTenant ? [between[3], between[1]] : [between[1], between[3]];
    f.landlordName = f.landlordName || l;
    f.tenantName = f.tenantName || t;
  }

  // PDFs break lines mid-sentence, so read the "premises at ..." address from the flattened text.
  const address = /\bpremises\s+(?:at|situated at|located at|bearing)\s+(.+?)(?=\s*(?:\(|hereinafter|for a monthly|on a monthly|\.\s|$))/i.exec(flat) || /\bAddress\s*(?:of the (?:premises|property))?\s*:\s*([^\n]+)/i.exec(text);
  if (address) f.propertyAddress = address[1].replace(/[,\s]+$/, '').trim();

  // Deduction lines in a landlord's message.
  f.paintingDeduction = amountAfter(text, /painting(?:\s+charges)?/);
  f.cleaningDeduction = amountAfter(text, /(?:deep\s+)?cleaning(?:\s+charges)?/);
  f.damageDeduction = amountAfter(text, /damages?(?:\s+(?:charges|to|for)\b)?/);
  const electricity = amountAfter(text, /electricity(?:\s+(?:dues|bill|charges))?/);
  const water = amountAfter(text, /water(?:\s+(?:dues|bill|charges))?/);
  if (electricity !== undefined || water !== undefined) f.utilityDuesDeduction = (electricity || 0) + (water || 0);
  f.unpaidRent = amountAfter(text, /(?:pending|unpaid|due)\s+rent|rent\s+(?:due|pending|arrears)/);
  const returned = /\b(?:returning|returned|refunding|refunded|transferring|transferred|sending|sent)\s+(?:you\s+)?(?:the\s+)?(?:balance\s+(?:of\s+)?)?(?:Rs\.?|INR|₹)\s*([\d,]+)/i.exec(flat);
  if (returned) f.amountReturned = money(returned[1]);
  f.moveOutDate = dateAfter(text, /vacated(?: the (?:premises|flat|house))? on|handed (?:over|back) the keys on|date of vacating/);
  return f;
}

export function extractByPatterns(packKey, text) {
  const clean = String(text || '').replace(/\s+([.,;:)])/g, '$1');
  const flat = clean.replace(/\s+/g, ' ');
  const raw = packKey === 'flight' ? extractFlight(clean, flat) : packKey === 'employment' ? extractEmployment(clean, flat) : packKey === 'rent' ? extractRent(clean, flat) : {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v))));
}
