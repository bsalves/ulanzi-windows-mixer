import UlanziApi, { Utils } from "../plugin-common-node/index.js";
import { start } from "./lib/app.js";

const $UD = new UlanziApi();
start($UD, Utils);
