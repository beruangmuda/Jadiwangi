import React from "react";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

export type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];

export function Icon({
  name,
  size = 24,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <MaterialDesignIcons name={name as IconName} size={size} color={color} />;
}
