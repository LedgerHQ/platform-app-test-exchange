import type { Unit } from "@ledgerhq/live-app-sdk";
import { BigNumber } from "bignumber.js";

const parseCurrencyUnit = (unit: Unit, valueString: string) => {
  const str = valueString.replace(/,/g, ".");
  const value = new BigNumber(str);
  if (value.isNaN()) return new BigNumber(0);
  return value.times(new BigNumber(10).pow(unit.magnitude)).integerValue();
};

export default parseCurrencyUnit;
