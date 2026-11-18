import renderer from "react-test-renderer";
import { api } from "@/store/api/apiSlice";

/** Release resources owned by each test, including trees a failing assertion leaves mounted. */
export function useRendererCleanup() {
  const trees = new Set<renderer.ReactTestRenderer>();
  const stores = new Set<{ dispatch: (action: any) => any }>();
  const create = renderer.create;
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    createSpy = jest.spyOn(renderer, "create").mockImplementation((...args) => {
      const tree = create(...args);
      trees.add(tree);
      return tree;
    });
  });

  afterEach(async () => {
    try {
      // Unmount first so effects remove intervals, AppState listeners and query subscriptions.
      await renderer.act(async () => {
        for (const tree of trees) tree.unmount();
      });
      for (const store of stores) {
        const requests = [
          ...store.dispatch(api.util.getRunningQueriesThunk()),
          ...store.dispatch(api.util.getRunningMutationsThunk()),
        ];
        for (const request of requests) request.abort();
        await Promise.all(requests);
        // Clear RTK Query polling and unused-cache retention timers after unsubscribe.
        store.dispatch(api.util.resetApiState());
      }
    } finally {
      trees.clear();
      stores.clear();
      createSpy.mockRestore();
    }
  });

  return function trackStore<T extends { dispatch: (action: any) => any }>(store: T): T {
    stores.add(store);
    return store;
  };
}
