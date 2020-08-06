import { defineAspects, Aspect } from './operation';
import { CommandOperation } from './command';
import type { Callback } from '../types';
import type { Server } from '../sdam/server';
const levelValues = new Set(['off', 'slow_only', 'all']);

export class SetProfilingLevelOperation extends CommandOperation {
  level: any;
  profile: any;

  constructor(db: any, level: any, options: any) {
    let profile = 0;
    if (level === 'off') {
      profile = 0;
    } else if (level === 'slow_only') {
      profile = 1;
    } else if (level === 'all') {
      profile = 2;
    }

    super(db, options);
    this.level = level;
    this.profile = profile;
  }

  execute(server: Server, callback: Callback) {
    const level = this.level;

    if (!levelValues.has(level)) {
      return callback(new Error('Error: illegal profiling level value ' + level));
    }

    super.executeCommand(server, { profile: this.profile }, (err, doc) => {
      if (err == null && doc.ok === 1) return callback(undefined, level);
      return err != null
        ? callback(err, null)
        : callback(new Error('Error with profile command'), null);
    });
  }
}

defineAspects(SetProfilingLevelOperation, [Aspect.EXECUTE_WITH_SELECTION]);
