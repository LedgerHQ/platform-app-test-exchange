import React, { useState } from "react";

import { ExchangeType } from "@ledgerhq/live-app-sdk";

import Swap from "./swap";

import styles from "../styles/Home.module.css";
import Transfer from "./transfer";

const ExchangeFlow = ({ exchangeType }: { exchangeType: ExchangeType }) => {
  switch (exchangeType) {
    case ExchangeType.SWAP:
      return <Swap />;

    case ExchangeType.FUND:
    case ExchangeType.SELL:
      return <Transfer exchangeType={exchangeType} />;

    default:
      return <div />;
  }
};

const Home = () => {
  const [exchangeType, setExchangeType] = useState(ExchangeType.SWAP);

  return (
    <div>
      <div>Selected flow: {ExchangeType[exchangeType]}</div>
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
