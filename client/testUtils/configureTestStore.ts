import { configureStore } from "@reduxjs/toolkit";
import { useRendererCleanup } from "./rendererCleanup";

const trackStore = useRendererCleanup();

/** Keep test-owned stores and mounted query subscribers within the test lifetime. */
export const configureTestStore = ((options: Parameters<typeof configureStore>[0]) =>
  trackStore(configureStore(options))) as typeof configureStore;
