import React, { useState } from "react";

import Swap from "./swap";
import Fund from "./fund";

import styles from "../styles/Home.module.css";

const Home = () => {
  const [mode, setMode] = useState("swap");

  return (
    <div>
      <div className={styles.header}>
        <button onClick={() => setMode("swap")}>{"Swap flow"}</button>
        <button onClick={() => setMode("fund")}>{"Fund flow"}</button>
      </div>
      {mode === "swap" ? <Swap /> : <Fund />}
    </div>
  );
};

export default Home;
