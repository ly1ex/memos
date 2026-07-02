import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instanceApi } from "@/api/client";
import { InstanceSetting, InstanceSetting_Key } from "@/api/types";

// Query keys factory
export const instanceKeys = {
  all: ["instance"] as const,
  profile: () => [...instanceKeys.all, "profile"] as const,
  settings: () => [...instanceKeys.all, "settings"] as const,
  setting: (key: InstanceSetting_Key) => [...instanceKeys.settings(), key] as const,
  settingsBatch: (keys: InstanceSetting_Key[]) => [...instanceKeys.settings(), "batch", ...keys] as const,
};

// Build setting name from key
const buildInstanceSettingName = (key: InstanceSetting_Key): string => {
  const keyName = InstanceSetting_Key[key];
  return `instance/settings/${keyName}`;
};

// Hook to fetch instance profile
export function useInstanceProfile() {
  return useQuery({
    queryKey: instanceKeys.profile(),
    queryFn: async () => {
      const profile = await instanceApi.getInstanceProfile({});
      return profile;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - instance profile rarely changes
  });
}

// Hook to fetch a specific instance setting
export function useInstanceSetting(key: InstanceSetting_Key) {
  return useQuery({
    queryKey: instanceKeys.setting(key),
    queryFn: async () => {
      const setting = await instanceApi.getInstanceSetting({
        name: buildInstanceSettingName(key),
      });
      return setting;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to fetch multiple instance settings
export function useInstanceSettings(keys: InstanceSetting_Key[]) {
  return useQuery({
    queryKey: instanceKeys.settingsBatch(keys),
    queryFn: async () => {
      const response = await instanceApi.batchGetInstanceSettings({
        names: keys.map(buildInstanceSettingName),
      });
      return response.settings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to update instance setting
export function useUpdateInstanceSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (setting: InstanceSetting) => {
      await instanceApi.updateInstanceSetting({ setting });
      return setting;
    },
    onSuccess: (setting) => {
      // Extract key from setting name and invalidate
      const keyMatch = setting.name.match(/instance\/settings\/(\w+)/);
      if (keyMatch) {
        const keyName = keyMatch[1] as keyof typeof InstanceSetting_Key;
        const key = InstanceSetting_Key[keyName];
        if (key !== undefined) {
          queryClient.setQueryData(instanceKeys.setting(key), setting);
        }
      }
      queryClient.invalidateQueries({ queryKey: instanceKeys.settings() });
    },
  });
}

// Derived hooks for common settings
export function useGeneralSetting() {
  const { data: setting, ...rest } = useInstanceSetting(InstanceSetting_Key.GENERAL);
  const generalSetting = setting?.value.case === "generalSetting" ? setting.value.value : undefined;
  return { data: generalSetting, ...rest };
}

export function useMemoRelatedSetting() {
  const { data: setting, ...rest } = useInstanceSetting(InstanceSetting_Key.MEMO_RELATED);
  const memoRelatedSetting = setting?.value.case === "memoRelatedSetting" ? setting.value.value : undefined;
  return { data: memoRelatedSetting, ...rest };
}
