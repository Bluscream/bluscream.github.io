# Calc

Small client-side calculators and converters. Nothing leaves the browser; the URL hash keeps the input so an
address can be shared (`#tool=date&q=14.03.2009`, `#tool=units&category=length&value=26.2&from=mi&to=km`,
`#tool=bases&q=0xFF`).

## Tools

- **Date & time** – type a date in almost any form and see how long ago (or until) it is: a calendar
  breakdown (years, months, days, hours, minutes, seconds, with real month lengths), the same span as a total
  in every unit (decimal years down to milliseconds), and facts about the date (weekday, day of year, ISO week,
  quarter, leap year, next anniversary, unix time, UTC). An optional second field changes the reference point
  from "now" to any other date. Results tick every second while "now" is involved.

  Accepted input: `14.03.2009`, `4.3.09`, `14.03.` (this year), `2009-03-14`, `2009-03-14T15:30`, `20090314`,
  `03/14/2009` (US order unless the first number exceeds 12), `14 March 2009`, `March 14, 2009`, `14. März 2009`,
  `March 2009`, `2009`, times such as `3:05 pm`, unix timestamps in seconds or milliseconds, `now`, `today`,
  `yesterday`, `tomorrow` (also German), and relative phrases like `3 days ago`, `in 2 weeks`,
  `2 years 3 months ago`, `an hour ago`, `vor 5 Minuten`. A bare duration (`1 week`) means "ago".
  Two-digit years up to ten years ahead of today are 20xx, later ones 19xx.
- **Units** – length, mass, temperature, area, volume, speed, data size (decimal and binary prefixes) and time,
  with the value shown in every unit of the category at once. Click a number to copy it unrounded.
- **Number bases** – one integer in any notation (`255`, `0xFF`, `0b1111_1111`, `0o377`, `FFh`, `-42`) shown as
  decimal, hex, binary and octal, with bit length, ASCII character and two's complement in 8/16/32/64 bits.
  Uses BigInt, so 64-bit values are exact.

## Development

Plain ES modules under `src/`, typed with JSDoc and checked by `tsc` (`checkJs`, strict). The parsing and
arithmetic (`date-parse.js`, `date-diff.js`, `units.js`, `bases.js`, `format.js`) have Node tests under `test/`;
the `ui-*.js` files only touch the DOM.

```bash
npm install      # TypeScript only, for the type check
npm run verify   # tsc --noEmit + node --test
```

Serve the repository root over HTTP (for example `python3 -m http.server`) and open `tools/calc/`.
