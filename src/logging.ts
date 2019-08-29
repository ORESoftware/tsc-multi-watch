import * as chalk from "chalk";


export const log = {
  info: console.log.bind(console, 'tsc-multi-watch:'),
  good: console.log.bind(console, chalk.cyan('tsc-multi-watch:')),
  veryGood: console.log.bind(console, chalk.green('tsc-multi-watch:')),
  warn: console.log.bind(console, chalk.yellow.bold('tsc-multi-watch:')),
  error: console.log.bind(console, chalk.red('tsc-multi-watch:'))
};


export default log;

