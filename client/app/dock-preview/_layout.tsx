import React from "react";
import {Tabs} from "expo-router";
import FundleafTabBar from "@/components/navigation/FundleafTabBar";
export default function PreviewTabs(){return <Tabs tabBar={p=><FundleafTabBar {...p}/>} screenOptions={{headerShown:false,tabBarHideOnKeyboard:true}}><Tabs.Screen name="index" options={{title:"Home"}}/><Tabs.Screen name="transaction" options={{title:"Transactions"}}/><Tabs.Screen name="budget" options={{title:"Budgets"}}/><Tabs.Screen name="profile" options={{title:"Profile"}}/></Tabs>}
