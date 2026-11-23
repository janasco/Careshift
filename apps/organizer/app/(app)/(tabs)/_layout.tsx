import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

function TabGlyph({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View
      style={[
        styles.glyph,
        { backgroundColor: focused ? colors.primarySoft : "transparent" },
      ]}
    >
      <Text
        style={[
          styles.glyphText,
          { color: focused ? colors.primaryDark : colors.subtle },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "800", color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          headerTitle: "CareShift",
          tabBarIcon: ({ focused }) => <TabGlyph label="T" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => <TabGlyph label="C" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: "Meds",
          tabBarIcon: ({ focused }) => <TabGlyph label="M" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ focused }) => <TabGlyph label="P" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabGlyph label="…" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 24,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphText: { fontSize: 11, fontWeight: "900" },
});
