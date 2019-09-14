'use strict';

import {asOptions, Type, OptionsToType} from '@oresoftware/cli';
import * as path from 'path';

export const options = asOptions([
  
  {
    name: 'help',
    type: Type.Boolean,
    help: `Get help.`
  },
  
  {
    name: 'dry_run',
    type: Type.Boolean,
    help: 'Make a dry-run happen.'
  },
  
  {
    name: 'ignore',
    short: 'i',
    type: Type.ArrayOfString,
    help: 'regexes of paths to be ignored.',
  },
  
  {
    name: 'root',
    short: 'r',
    type: Type.String,
    help: 'Root to search from',
    default: process.cwd()
  }

]);

export default options;

export type CliOpts = OptionsToType<typeof options>
