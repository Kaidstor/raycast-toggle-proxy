import { MenuBarExtra, getPreferenceValues, showToast, Toast, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import * as execa from "execa";
import { tmux } from "./utils/exec";

type Preferences = {
   xrayPath?: string;
   host: string;
   port: string;
};

export default function MenuBarProxy() {
   const prefs = getPreferenceValues<Preferences>();
   const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

   useEffect(() => {
      checkProxy();
   }, []);


   async function isPortInUse(port: string) {
      try {
         const { stdout } = await execa.execaCommand(`lsof -i :${port} -sTCP:LISTEN`);
         return stdout.includes("(LISTEN)"); // Проверяем наличие "LISTEN"
      } catch {
         return false;
      }
   }

   async function checkProxy() {
      try {
         const { stdout } = await execa.execaCommand(`/usr/sbin/networksetup -getsocksfirewallproxy Wi-Fi`);

         setIsEnabled(stdout.includes("Yes"));
      } catch {
         setIsEnabled(false);
      }
   }

   async function toggleProxy() {
      if (isEnabled) {
         // Выключаем SOCKS
         try {
            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi off`);

            showToast(Toast.Style.Success, "Proxy выключен");
            setIsEnabled(false);
         } catch {
            showToast(Toast.Style.Failure, "Не удалось выключить прокси");
         }
      } else {
         try {
            const xrayPath = prefs.xrayPath;
            const host = prefs.host || '127.0.0.1'
            const port = prefs.port || '1080'

            const isProxyRunning = await isPortInUse(port);

            if (!isProxyRunning) {
               if (!xrayPath) {
                  showToast(Toast.Style.Failure, `На порту ${port} нет запущенных прокси, и путь до Xray не указан`);
                  return;
               }

               // Запускаем tmux
               const cmd = `new-session -d -s toggle-proxy-xray "cd ${xrayPath} && xray"`;
               await tmux(cmd);

               const isProxyRunning = await isPortInUse(port);

               if (isProxyRunning) {
                  showToast(Toast.Style.Success, `Tmux сессия для прокси запущена через ${xrayPath}`);
               }
               else {
                  showToast(Toast.Style.Failure, "Не удалось включить прокси");
               }
            }

            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxy Wi-Fi ${host} ${port}`);
            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi on`);
            showToast(Toast.Style.Success, `Proxy ${host}:${port} включен`);
            setIsEnabled(true);
         } catch (e) {
            console.log(e);
            showToast(Toast.Style.Failure, "Не удалось включить прокси");
         }
      }
   }

   return (
      <MenuBarExtra
         isLoading={isEnabled === null}
         icon={isEnabled ? Icon.BullsEyeMissed : Icon.BullsEye}
      >
         {isEnabled ? (
            <MenuBarExtra.Item title="Выключить прокси" onAction={toggleProxy} />
         ) : (
            <MenuBarExtra.Item title="Включить прокси" onAction={toggleProxy} />
         )}
      </MenuBarExtra>
   );
}