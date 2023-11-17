import { ExchangeType } from "@ledgerhq/wallet-api-core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import Swap from "./swap";
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
  const router = useRouter();
  const [theme, setTheme] = useState(router.query.theme);
  const [exchangeType, setExchangeType] = useState(ExchangeType.SWAP);

  useEffect(() => {
    if (router.query.theme) {
      setTheme(router.query.theme);
    }
  }, [router.query.theme]);

  return (
    <div style={theme === "dark" ? { color: "white" } : undefined}>
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
