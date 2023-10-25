import { Transport, WindowMessageTransport } from "@ledgerhq/wallet-api-client";
import { WalletAPIProvider } from "@ledgerhq/wallet-api-client-react";
import type { AppProps } from "next/app";
import { PropsWithChildren } from "react";
import "../styles/globals.css";

function TransportProvider({ children }: PropsWithChildren) {
  function getWalletAPITransport(): Transport {
    if (typeof window === "undefined") {
      return {
        onMessage: undefined,
        send: () => {},
      };
    }

    const transport = new WindowMessageTransport();
    transport.connect();
    return transport;
  }

  const transport = getWalletAPITransport();

  return (
    <WalletAPIProvider transport={transport}>{children}</WalletAPIProvider>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <TransportProvider>
      <Component {...pageProps} />
    </TransportProvider>
  );
}

export default MyApp;
