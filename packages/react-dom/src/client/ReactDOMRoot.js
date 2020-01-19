/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DOMContainer} from './ReactDOM';
import type {RootTag} from 'shared/ReactRootTags';
import type {ReactNodeList} from 'shared/ReactTypes';
// TODO: This type is shared between the reconciler and ReactDOM, but will
// eventually be lifted out to the renderer.
import type {FiberRoot} from 'react-reconciler/src/ReactFiberRoot';

export type RootType = {
  render(children: ReactNodeList, callback: ?() => mixed): void,
  unmount(callback: ?() => mixed): void,

  _internalRoot: FiberRoot,
};

export type RootOptions = {
  hydrate?: boolean,
  hydrationOptions?: {
    onHydrated?: (suspenseNode: Comment) => void,
    onDeleted?: (suspenseNode: Comment) => void,
  },
};

import {
  isContainerMarkedAsRoot,
  markContainerAsRoot,
  unmarkContainerAsRoot,
} from './ReactDOMComponentTree';
import {eagerlyTrapReplayableEvents} from '../events/ReactDOMEventReplaying';
import {
  ELEMENT_NODE,
  COMMENT_NODE,
  DOCUMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
} from '../shared/HTMLNodeType';

import {createContainer, updateContainer} from 'react-reconciler/inline.dom';
import invariant from 'shared/invariant';
import warningWithoutStack from 'shared/warningWithoutStack';
import {BlockingRoot, ConcurrentRoot, LegacyRoot} from 'shared/ReactRootTags';

function ReactDOMRoot(container: DOMContainer, options: void | RootOptions) {
  this._internalRoot = createRootImpl(container, ConcurrentRoot, options);
}

// #app 0 undefined
// 过渡时期可调用这个api
function ReactDOMBlockingRoot(
  container: DOMContainer,
  tag: RootTag,
  options: void | RootOptions,
) {
  this._internalRoot = createRootImpl(container, tag, options); // fiberRoot
}

// 真正的渲染reactElements
ReactDOMRoot.prototype.render = ReactDOMBlockingRoot.prototype.render = function(
  children: ReactNodeList,
  callback: ?() => mixed,
): void {
  const root = this._internalRoot; // fiberRoot
  // 渲染结束后回调
  const cb = callback === undefined ? null : callback;
  if (__DEV__) {
    warnOnInvalidCallback(cb, 'render'); // 校验render回调不合法
  }
  // 更新容器
  updateContainer(children, root, null, cb);
};

ReactDOMRoot.prototype.unmount = ReactDOMBlockingRoot.prototype.unmount = function(
  callback: ?() => mixed,
): void {
  const root = this._internalRoot;
  const cb = callback === undefined ? null : callback;
  if (__DEV__) {
    warnOnInvalidCallback(cb, 'render');
  }
  const container = root.containerInfo;
  updateContainer(null, root, null, () => {
    unmarkContainerAsRoot(container);
    if (cb !== null) {
      cb();
    }
  });
};

// #app 0 undefined
function createRootImpl(
  container: DOMContainer,
  tag: RootTag, // ConcurrentRoot
  options: void | RootOptions,
) {
  // Tag is either LegacyRoot or Concurrent Root
  const hydrate = options != null && options.hydrate === true;
  const hydrationCallbacks =
    (options != null && options.hydrationOptions) || null;
  // createFiberRoot
  const root = createContainer(container, tag, hydrate, hydrationCallbacks); // fiberroot
  markContainerAsRoot(root.current, container); // 标记这个div容器给这个fiberroot用了，其他人就别用了
  if (hydrate && tag !== LegacyRoot) {
    const doc =
      container.nodeType === DOCUMENT_NODE
        ? container
        : container.ownerDocument;
    eagerlyTrapReplayableEvents(doc);
  }
  return root;
}

// 新的reactDom入口api
export function createRoot( // create  Fiberroot
  container: DOMContainer,
  options?: RootOptions, // hydrate参数配置
): RootType {
  invariant(
    isValidContainer(container), // 校验是否是合法的dom
    'createRoot(...): Target container is not a DOM element.',
  );
  warnIfReactDOMContainerInDEV(container);
  return new ReactDOMRoot(container, options);
}

export function createBlockingRoot(
  container: DOMContainer,
  options?: RootOptions,
): RootType {
  invariant(
    isValidContainer(container),
    'createRoot(...): Target container is not a DOM element.',
  );
  warnIfReactDOMContainerInDEV(container);
  return new ReactDOMBlockingRoot(container, BlockingRoot, options);
}

// #app undefined
export function createLegacyRoot(
  container: DOMContainer,
  options?: RootOptions,
): RootType {
  // #app 0 undefined
  return new ReactDOMBlockingRoot(container, LegacyRoot, options);
}

export function isValidContainer(node: mixed): boolean {
  return !!(
    node &&
    (node.nodeType === ELEMENT_NODE ||
      node.nodeType === DOCUMENT_NODE ||
      node.nodeType === DOCUMENT_FRAGMENT_NODE ||
      (node.nodeType === COMMENT_NODE &&
        (node: any).nodeValue === ' react-mount-point-unstable '))
  );
}

export function warnOnInvalidCallback(
  callback: mixed,
  callerName: string,
): void {
  if (__DEV__) {
    warningWithoutStack(
      callback === null || typeof callback === 'function',
      '%s(...): Expected the last optional `callback` argument to be a ' +
        'function. Instead received: %s.',
      callerName,
      callback,
    );
  }
}

function warnIfReactDOMContainerInDEV(container) {
  if (__DEV__) {
    if (isContainerMarkedAsRoot(container)) {
      if (container._reactRootContainer) {
        warningWithoutStack( // 之前你使用过这个容器
          false,
          'You are calling ReactDOM.createRoot() on a container that was previously ' +
            'passed to ReactDOM.render(). This is not supported.',
        );
      } else {
        warningWithoutStack(
          false,
          'You are calling ReactDOM.createRoot() on a container that ' +
            'has already been passed to createRoot() before. Instead, call ' +
            'root.render() on the existing root instead if you want to update it.',
        );
      }
    }
  }
}
