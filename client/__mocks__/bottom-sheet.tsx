import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from "react";
import { ScrollView, TextInput, View } from "react-native";
export const sheetLifecycle = {
  present: jest.fn(),
  dismiss: jest.fn(),
  deferDismiss: false,
  deferPresent: false,
};
export const sheetInstances = new Map<
  string,
  { swipe: () => void; completeOpen: () => void; completeClose: () => void }
>();
export const BottomSheetModalProvider = ({ children }: any) => children;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetTextInput = TextInput;
export const BottomSheetBackdrop = (props: any) => <View {...props} />;
export const BottomSheetModal = forwardRef<any, any>(
  function MockSheet(props, ref) {
    const [visible, setVisible] = useState(false);
    const latest = useRef(props);
    latest.current = props;
    const status = useRef("closed");
    const completeOpen = () => {
      if (status.current !== "presenting") return;
      status.current = "open";
      latest.current.onChange?.(0);
    };
    const completeClose = () => {
      if (status.current !== "closing" && status.current !== "open") return;
      status.current = "closed";
      setVisible(false);
      latest.current.onDismiss?.();
    };
    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          sheetLifecycle.present();
          // Real Gorhom suppresses portal mounting when a redundant dismiss has
          // left its internal status in DISMISSING, even though it is unmounted.
          if (status.current === "poisoned" || status.current === "closing")
            return;
          status.current = "presenting";
          setVisible(true);
          if (!sheetLifecycle.deferPresent) completeOpen();
        },
        dismiss: () => {
          sheetLifecycle.dismiss();
          if (status.current === "closed") {
            status.current = "poisoned";
            return;
          }
          if (status.current !== "open") return;
          status.current = "closing";
          if (!sheetLifecycle.deferDismiss) completeClose();
        },
      }),
      [],
    );
    useEffect(() => {
      const key = props.accessibilityLabel;
      sheetInstances.set(key, {
        swipe: () => completeClose(),
        completeOpen,
        completeClose,
      });
      return () => {
        sheetInstances.delete(key);
      };
    }, [props.accessibilityLabel]);
    return visible ? (
      <View testID="native-bottom-sheet" {...props}>
        {props.handleComponent?.()}
        {props.backdropComponent?.({})}
        {props.children}
      </View>
    ) : null;
  },
);
