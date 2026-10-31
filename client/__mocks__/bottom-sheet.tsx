import React, { forwardRef, useImperativeHandle, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
export const sheetLifecycle = { present: jest.fn(), dismiss: jest.fn() };
export const BottomSheetModalProvider = ({ children }: any) => children;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetTextInput = TextInput;
export const BottomSheetBackdrop = (props: any) => <View {...props} />;
export const BottomSheetModal = forwardRef<any, any>(
  function MockSheet(props, ref) {
    const [visible, setVisible] = useState(false);
    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          sheetLifecycle.present();
          setVisible(true);
        },
        dismiss: () => {
          sheetLifecycle.dismiss();
          setVisible(false);
        },
      }),
      [],
    );
    return visible ? (
      <View testID="native-bottom-sheet" {...props}>
        {props.handleComponent?.()}
        {props.backdropComponent?.({})}
        {props.children}
      </View>
    ) : null;
  },
);
