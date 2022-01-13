import "../styles/globals.css";
import type { AppProps } from "next/app";

import LedgerLiveSDKProvider from "../src/providers/LedgerLiveSDKProvider";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LedgerLiveSDKProvider>
      <Component {...pageProps} />
    </LedgerLiveSDKProvider>
  );
}

export default MyApp;
