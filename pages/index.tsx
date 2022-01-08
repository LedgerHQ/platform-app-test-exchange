import React, { useState } from "react";

import { ExchangeType } from "@ledgerhq/live-app-sdk";

import Swap from "./swap";
import Fund from "./fund";
import Sell from "./sell";

import styles from "../styles/Home.module.css";

const ExchangeFlow = ({ exchangeType }: { exchangeType: ExchangeType }) => {
  switch (exchangeType) {
    case ExchangeType.SWAP:
      return <Swap />;

    case ExchangeType.FUND:
      return <Fund />;

    case ExchangeType.SELL:
      return <Sell />;

    default:
      return <div />;
  }
};

const Home = () => {
  const [exchangeType, setExchangeType] = useState(ExchangeType.SWAP);

  return (
    <div>
      <div className={styles.header}>
        <button onClick={() => setExchangeType(ExchangeType.SWAP)}>
          {"Swap flow"}
        </button>
        <button onClick={() => setExchangeType(ExchangeType.FUND)}>
          {"Fund flow"}
        </button>
        <button onClick={() => setExchangeType(ExchangeType.SELL)}>
          {"Sell flow"}
        </button>
      </div>
      <ExchangeFlow exchangeType={exchangeType} />
    </div>
  );
};

export default Home;
