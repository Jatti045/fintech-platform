import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import * as RN from "react-native";
import { PlatformPressable } from "@react-navigation/elements";
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated from "react-native-reanimated";
import FundleafTabBar from "@/components/navigation/FundleafTabBar";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import { FLOATING_TAB_BAR, getFloatingTabBarHeight } from "@/constants/appConfig";

jest.mock("@react-navigation/native", () => ({CommonActions:{navigate:(route:any)=>({type:"NAVIGATE",payload:route})},useLinkBuilder:()=>({buildHref:(name:string)=>`/${name==="index"?"":name}`})}));
jest.mock("@react-navigation/elements",()=>({PlatformPressable:(props:any)=>require("react").createElement(require("react-native").TouchableOpacity,props)}));
jest.mock("@react-navigation/bottom-tabs",()=>({BottomTabBarHeightCallbackContext:require("react").createContext(undefined)}));
const routes=[{key:"home",name:"index"},{key:"tx",name:"transaction",params:{screen:"detail",id:"preserved"}},{key:"budget",name:"budget"},{key:"profile",name:"profile"}];
function setup(index=0,theme="Light",safeBottom=0){
 const store=configureStore({reducer:{theme:themeReducer}});store.dispatch(setTheme(theme));
 const emit=jest.fn(()=>({defaultPrevented:false})),dispatch=jest.fn(),height=jest.fn();
 const props={state:{index,key:"tabs",routes},descriptors:Object.fromEntries(routes.map(r=>[r.key,{options:{}}])),navigation:{emit,dispatch},insets:{top:0,bottom:safeBottom,left:0,right:0}} as unknown as BottomTabBarProps;
 let tree!:renderer.ReactTestRenderer;
 const render=()=> <Provider store={store}><BottomTabBarHeightCallbackContext.Provider value={height}><FundleafTabBar {...props}/></BottomTabBarHeightCallbackContext.Provider></Provider>;
 act(()=>{tree=renderer.create(render())});
 return {tree,props,emit,dispatch,height,store,update:()=>act(()=>tree.update(render()))};
}
const tabs=(tree:renderer.ReactTestRenderer)=>tree.root.findAllByType(PlatformPressable);
beforeEach(()=>{jest.clearAllMocks();jest.spyOn(RN,"useWindowDimensions").mockReturnValue({width:390,height:844,scale:2,fontScale:1})});
afterEach(()=>jest.restoreAllMocks());
it.each(["Light","Dark"])("%s renders one active label with selected state and theme contrast",theme=>{
 const {tree}=setup(1,theme);
 const buttons=tabs(tree),palette=theme==="Light"?THEME_PALETTES.LIGHT:THEME_PALETTES.DARK;
 expect(buttons).toHaveLength(4);
 expect(buttons.map(n=>n.props.accessibilityLabel)).toEqual(["Home","Transactions","Budgets","Profile"]);
 expect(buttons.map(n=>n.props.accessibilityState.selected)).toEqual([false,true,false,false]);
 expect(buttons[1].props.style.backgroundColor).toBe(palette.primary);
 expect(tree.root.findAllByType(RN.Text).map(n=>n.props.children)).toEqual(["Transactions"]);
 expect(buttons.every(n=>n.props.accessibilityRole==="tab"&&n.props.style.minHeight>=48)).toBe(true);
 act(()=>tree.unmount());
});
it("uses navigator events, retains route params and dispatches to the correct navigator",()=>{
 const {tree,emit,dispatch}=setup();
 act(()=>tabs(tree)[1].props.onPress());
 expect(emit).toHaveBeenCalledWith({type:"tabPress",target:"tx",canPreventDefault:true});
 expect(dispatch).toHaveBeenCalledWith({type:"NAVIGATE",payload:routes[1],target:"tabs"});
 expect(tabs(tree)[1].props.href).toBe("/transaction");
 act(()=>tabs(tree)[2].props.onLongPress());expect(emit).toHaveBeenLastCalledWith({type:"tabLongPress",target:"budget"});
 act(()=>tree.unmount());
});
it("respects preventDefault and reselects without resetting route state",()=>{
 const {tree,emit,dispatch}=setup();
 act(()=>tabs(tree)[0].props.onPress());expect(emit).toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled();
 emit.mockReturnValue({defaultPrevented:true});act(()=>tabs(tree)[2].props.onPress());expect(dispatch).not.toHaveBeenCalled();
 act(()=>tree.unmount());
});
it("selection follows updated navigator state rather than a local selection",()=>{
 const {tree,props,update}=setup();
 props.state={...props.state,index:3};update();
 expect(tabs(tree).map(n=>n.props.accessibilityState.selected)).toEqual([false,false,false,true]);
 expect(tree.root.findAllByType(RN.Text).map(n=>n.props.children)).toEqual(["Profile"]);
 act(()=>tree.unmount());
});
it("hides on keyboard events, restores reserved space and removes subscriptions",()=>{
 const {tree,height}=setup(0,"Light",34);
 expect(height).toHaveBeenLastCalledWith(getFloatingTabBarHeight()+24+34);
 const calls=(RN.Keyboard.addListener as jest.Mock).mock.calls;
 act(()=>calls.find(c=>c[0]==="keyboardWillShow")![1]());expect(tabs(tree)).toHaveLength(0);expect(height).toHaveBeenLastCalledWith(0);
 act(()=>calls.find(c=>c[0]==="keyboardWillHide")![1]());expect(tabs(tree)).toHaveLength(4);
 const subscriptions=(RN.Keyboard.addListener as jest.Mock).mock.results.map(r=>r.value);
 act(()=>tree.unmount());for(const s of subscriptions)expect(s.remove).toHaveBeenCalled();
});
it.each([[320,1],[820,1],[320,2]])("fits %s px and font scale %s without shrinking touch targets",(width,fontScale)=>{
 (RN.useWindowDimensions as jest.Mock).mockReturnValue({width,height:844,scale:2,fontScale});
 const {tree}=setup(1);
 const dock=tree.root.findAllByType(RN.View).find(n=>n.props.accessibilityRole==="tablist")!;
 expect(dock.props.style.height).toBe(getFloatingTabBarHeight(fontScale));expect(dock.props.style.maxWidth).toBe(FLOATING_TAB_BAR.maxWidth);
 const items=tree.root.findAllByType(Animated.View).filter(n=>n.props.layout);
 const minWidths=items.reduce((sum,n)=>sum+n.props.style.minWidth,0);
 expect(minWidths).toBeLessThanOrEqual(Math.min(560,width-40)-14);
 expect(items.every(n=>n.props.layout.duration===200&&n.props.layout.reduceMotion==="system")).toBe(true);
 act(()=>tree.unmount());
});

it("uses Android keyboard events and starts hidden when a keyboard is already visible",()=>{
 jest.replaceProperty(RN.Platform,"OS","android");
 const {tree}=setup();
 const calls=(RN.Keyboard.addListener as jest.Mock).mock.calls;
 expect(calls.map(c=>c[0])).toEqual(["keyboardDidShow","keyboardDidHide"]);
 act(()=>calls[0][1]());expect(tabs(tree)).toHaveLength(0);
 act(()=>calls[1][1]());expect(tabs(tree)).toHaveLength(4);
 act(()=>tree.unmount());
 (RN.Keyboard.isVisible as jest.Mock).mockReturnValueOnce(true);
 const hidden=setup();expect(tabs(hidden.tree)).toHaveLength(0);act(()=>hidden.tree.unmount());
});
