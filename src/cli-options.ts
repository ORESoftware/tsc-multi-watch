'use strict';

import {asOptions, Type} from '@oresoftware/cli';
import * as path from 'path';


export default asOptions([
  
  {
    name: 'help',
    type: Type.Boolean,
    help: `Get help with the 'ntrs ${path.basename(__dirname)}' command`
  },
  
  {
    name: 'dry_run',
    type: Type.Boolean,
    help: 'Make a dry-run happen.'
  },
  
  {
    name: 'root',
    short: 'r',
    type: Type.String,
    help: 'Root to search from',
    default: process.cwd()
  }
  
]);
