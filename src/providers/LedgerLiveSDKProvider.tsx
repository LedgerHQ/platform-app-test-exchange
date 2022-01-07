import React, { createContext, useState, useEffect, useContext } from "react";
import LedgerLiveApi, { WindowMessageTransport } from "@ledgerhq/live-app-sdk";

type LedgerLiveSDKContextType = {
  api?: LedgerLiveApi;
};

const defaultContext: LedgerLiveSDKContextType = { api: undefined };

export const LedgerLiveSDKContext =
  createContext<LedgerLiveSDKContextType>(defaultContext);

const LedgerLiveSDKProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => {
  const [api, setApi] = useState<LedgerLiveApi | null>(null);

  useEffect(() => {
    const llapi = new LedgerLiveApi(new WindowMessageTransport());

    setApi(llapi);

    llapi.connect();

    return () => {
      setApi(null);
      void llapi.disconnect();
    };
  }, []);

  if (!api) {
    return <></>;
  }

  return (
    <LedgerLiveSDKContext.Provider value={{ api }}>
      {children}
    </LedgerLiveSDKContext.Provider>
  );
};

export const useApi = () => {
  const { api } = useContext(LedgerLiveSDKContext);

  // This should never theoretically never happen
  if (!api) {
    throw new Error("API not initialized");
    // console.log("API not initialized");
  }

  return api;
};

export default LedgerLiveSDKProvider;
