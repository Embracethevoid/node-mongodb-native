import { defineAspects, Aspect, OperationBase } from './operation';
import { deleteCallback, removeDocuments } from './common_functions';
import { CommandOperation, CommandOperationOptions } from './command';
import { isObject } from 'util';
import type { Callback, Document } from '../types';
import type { Server } from '../sdam/server';
import type { Collection } from '../collection';

export interface DeleteOperationOptions extends CommandOperationOptions {
  single: boolean;
}

export class DeleteOperation extends OperationBase {
  namespace: string;
  operations: Document[];

  constructor(ns: string, ops: Document[], options: DeleteOperationOptions) {
    super(options);
    this.namespace = ns;
    this.operations = ops;
  }

  get canRetryWrite(): boolean {
    return this.operations.every(op => (typeof op.limit !== 'undefined' ? op.limit > 0 : true));
  }

  execute(server: Server, callback: Callback): void {
    server.remove(this.namespace.toString(), this.operations, this.options, callback);
  }
}

export class DeleteOneOperation extends CommandOperation {
  collection: Collection;
  filter: Document;

  constructor(collection: Collection, filter: Document, options: DeleteOperationOptions) {
    super(collection, options);

    this.collection = collection;
    this.filter = filter;
  }

  execute(server: Server, callback: Callback): void {
    const coll = this.collection;
    const filter = this.filter;
    const options: DeleteOperationOptions = this.options;

    options.single = true;
    removeDocuments(server, coll, filter, options, (err, r) => deleteCallback(err, r, callback));
  }
}

export class DeleteManyOperation extends CommandOperation {
  collection: Collection;
  filter: Document;

  constructor(collection: Collection, filter: Document, options: DeleteOperationOptions) {
    super(collection, options);

    if (!isObject(filter)) {
      throw new TypeError('filter is a required parameter');
    }

    this.collection = collection;
    this.filter = filter;
  }

  execute(server: Server, callback: Callback): void {
    const coll = this.collection;
    const filter = this.filter;
    const options: DeleteOperationOptions = this.options;

    // a user can pass `single: true` in to `deleteMany` to remove a single document, theoretically
    if (typeof options.single !== 'boolean') {
      options.single = false;
    }

    removeDocuments(server, coll, filter, options, (err, r) => deleteCallback(err, r, callback));
  }
}

defineAspects(DeleteOperation, [
  Aspect.RETRYABLE,
  Aspect.WRITE_OPERATION,
  Aspect.EXECUTE_WITH_SELECTION
]);

defineAspects(DeleteOneOperation, [
  Aspect.RETRYABLE,
  Aspect.WRITE_OPERATION,
  Aspect.EXECUTE_WITH_SELECTION
]);

defineAspects(DeleteManyOperation, [Aspect.WRITE_OPERATION, Aspect.EXECUTE_WITH_SELECTION]);
