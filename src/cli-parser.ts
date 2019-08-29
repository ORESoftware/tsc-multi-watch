'use strict';

import * as path from "path";
import cliOpts from "./cli-options";
import {CliParser} from "@oresoftware/cli";

export default new CliParser(cliOpts, {commandName: 'tsc_multi_watch'});
