import { MenuBarExtra, getPreferenceValues, showToast, Toast, Icon, environment, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import * as execa from "execa";
import { tmux, execWithEnv } from "./utils/exec";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

type Preferences = {
   xrayPath?: string;
   host: string;
   port: string;
   defaultConfig?: string;
};

const cache = new Cache({ namespace: "menu-bar-proxy" });

export default function MenuBarProxy() {
   const prefs = getPreferenceValues<Preferences>();
   const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
   const [isTmuxInstalled, setIsTmuxInstalled] = useState<boolean | null>(null);
   const [currentConfig, setCurrentConfig] = useState<string | null>(null);
   const [availableConfigs, setAvailableConfigs] = useState<string[]>([]);

   useEffect(() => {
      checkProxy();
      checkTmuxInstalled();
      getCurrentConfig();
      loadAvailableConfigs();
   }, []);

   function getXrayPath(): string {
      const xrayPath = prefs.xrayPath || "~/xray";
      return xrayPath.startsWith("~") ? path.join(os.homedir(), xrayPath.slice(1)) : xrayPath;
   }

   function loadAvailableConfigs() {
      try {
         const xrayPath = getXrayPath();
         const cacheKey = `configs_${xrayPath}`;

         // Проверяем кэш
         const cached = cache.get(cacheKey);
         if (cached) {
            try {
               const cachedData = JSON.parse(cached);
               const cacheAge = Date.now() - cachedData.timestamp;

               // Используем кэш если данные свежие (30 секунд)
               if (cacheAge < 30000) {
                  setAvailableConfigs(cachedData.configs);
                  return;
               }
            } catch (error) {
               console.log("Invalid cached data, refreshing...");
            }
         }

         // Сканируем папку
         const configs: string[] = [];

         if (fs.existsSync(xrayPath)) {
            const files = fs.readdirSync(xrayPath)
               .filter(file => file.endsWith('.json'))
               .sort();

            configs.push(...files);
         }

         // Если нет конфигов, добавляем дефолтный
         if (configs.length === 0) {
            configs.push('config.json');
         }

         // Сохраняем в кэш
         const cacheData = {
            configs,
            timestamp: Date.now()
         };
         cache.set(cacheKey, JSON.stringify(cacheData));

         setAvailableConfigs(configs);
      } catch (error) {
         console.log("Error loading configs:", error);
         setAvailableConfigs(['config.json']); // fallback
      }
   }

   async function getCurrentConfig(): Promise<void> {
      try {
         const sessions = await tmux("list-sessions -F '#{session_name}'");
         const sessionLines = sessions.stdout.split('\n').filter(line => line.trim());

         for (const sessionName of sessionLines) {
            if (sessionName.startsWith('toggle-proxy-')) {
               const configName = sessionName.replace('toggle-proxy-', '');
               setCurrentConfig(configName);
               return;
            }
         }
         setCurrentConfig(null);
      } catch {
         setCurrentConfig(null);
      }
   }

   async function checkTmuxInstalled() {
      try {
         // Try to execute a simple tmux command
         await tmux("has-session -t non-existent-session 2>/dev/null || true");
         setIsTmuxInstalled(true);
      } catch (error) {
         setIsTmuxInstalled(false);

         // Log the error
         const logPath = path.join(environment.supportPath, "logs");
         try {
            if (!fs.existsSync(logPath)) {
               fs.mkdirSync(logPath, { recursive: true });
            }
            fs.appendFileSync(
               path.join(logPath, "tmux-check.log"),
               `${new Date().toISOString()} - Tmux not installed or not in PATH: ${JSON.stringify(error)}\n`,
            );
         } catch (e) {
            console.error("Failed to write to log file:", e);
         }
      }
   }

   async function isPortInUse(port: string): Promise<boolean> {
      try {
         const { stdout } = await execWithEnv(`lsof -i :${port} -sTCP:LISTEN`);
         console.log({ stdout });
         return stdout.includes("(LISTEN)");
      } catch (e) {
         console.log(e);
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

   async function waitForPortToOpen(port: string, maxAttempts = 10, delayMs = 500): Promise<boolean> {
      for (let i = 0; i < maxAttempts; i++) {
         if (await isPortInUse(port)) {
            return true;
         }
         await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return false;
   }

   async function stopAllProxySessions() {
      try {
         const sessions = await tmux("list-sessions -F '#{session_name}'");
         const sessionLines = sessions.stdout.split('\n').filter(line => line.trim());

         for (const sessionName of sessionLines) {
            if (sessionName.startsWith('toggle-proxy-')) {
               await tmux(`kill-session -t ${sessionName}`);
            }
         }
         setCurrentConfig(null);
      } catch (error) {
         console.log("No sessions to stop or error stopping:", error);
      }
   }

   async function startProxyWithConfig(configName: string) {
      try {
         const xrayPath = getXrayPath();
         const host = prefs.host || "127.0.0.1";
         const port = prefs.port || "1080";

         if (!isTmuxInstalled) {
            showToast(
               Toast.Style.Failure,
               "Tmux не установлен или не найден в PATH",
               "Установите tmux или добавьте его в PATH",
            );
            return false;
         }

         if (!fs.existsSync(xrayPath)) {
            showToast(Toast.Style.Failure, `Папка Xray не найдена: ${xrayPath}`);
            return false;
         }

         const configPath = path.join(xrayPath, configName);
         if (!fs.existsSync(configPath)) {
            showToast(Toast.Style.Failure, `Конфиг не найден: ${configPath}`);
            return false;
         }

         // Stop any existing proxy sessions
         await stopAllProxySessions();

         // Start new session
         const sessionName = `toggle-proxy-${configName.replace('.json', '')}`;
         const cmd = `new-session -d -s ${sessionName} "cd ${xrayPath} && xray -config ${configName}"`;

         await tmux(cmd);

         // Wait for the proxy to start with improved retry logic
         const isStarted = await waitForPortToOpen(port, 15, 300);

         if (isStarted) {
            setCurrentConfig(configName.replace('.json', ''));
            showToast(Toast.Style.Success, `Прокси запущен с конфигом: ${configName}`);
            return true;
         } else {
            // Try to get tmux session output for debugging
            try {
               const sessionOutput = await tmux(`capture-pane -t ${sessionName} -p`);
               const logPath = path.join(environment.supportPath, "logs");
               if (!fs.existsSync(logPath)) {
                  fs.mkdirSync(logPath, { recursive: true });
               }
               fs.appendFileSync(
                  path.join(logPath, "proxy-errors.log"),
                  `${new Date().toISOString()} - Failed to start proxy with config ${configName}. Session output:\n${sessionOutput.stdout}\n`,
               );
            } catch (captureError) {
               console.log("Could not capture session output:", captureError);
            }

            showToast(Toast.Style.Failure, "Не удалось запустить прокси. Проверьте конфиг и логи");
            return false;
         }
      } catch (error) {
         const logPath = path.join(environment.supportPath, "logs");
         try {
            if (!fs.existsSync(logPath)) {
               fs.mkdirSync(logPath, { recursive: true });
            }
            fs.appendFileSync(
               path.join(logPath, "proxy-errors.log"),
               `${new Date().toISOString()} - Tmux error: ${JSON.stringify(error)}\n`,
            );
         } catch (e) {
            console.error("Failed to write to log file:", e);
         }

         showToast(Toast.Style.Failure, "Ошибка запуска tmux. Проверьте логи");
         return false;
      }
   }

   async function toggleProxy(configName?: string) {
      if (isEnabled && !configName) {
         // Выключаем SOCKS только если не указан конфиг (т.е. нажали "Выключить")
         try {
            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi off`);
            await stopAllProxySessions();
            showToast(Toast.Style.Success, "Proxy выключен");
            setIsEnabled(false);
         } catch {
            showToast(Toast.Style.Failure, "Не удалось выключить прокси");
         }
      } else {
         // Включаем или переключаем на другой конфиг
         try {
            const host = prefs.host || "127.0.0.1";
            const port = prefs.port || "1080";
            const configToUse = configName || prefs.defaultConfig || 'config.json';

            // Если выбран тот же конфиг, что уже запущен - ничего не делаем
            if (isEnabled && currentConfig === configToUse.replace('.json', '')) {
               showToast(Toast.Style.Success, `Конфиг ${configToUse} уже активен`);
               return;
            }

            const xrayPath = prefs.xrayPath;
            if (!xrayPath) {
               showToast(Toast.Style.Failure, "Путь до Xray не указан");
               return;
            }

            const started = await startProxyWithConfig(configToUse);
            if (!started) {
               return;
            }

            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxy Wi-Fi ${host} ${port}`);
            await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi on`);
            showToast(Toast.Style.Success, `Proxy ${host}:${port} включен с конфигом: ${configToUse}`);
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
         tooltip={isTmuxInstalled === false ? "Tmux не установлен" : currentConfig ? `Активный конфиг: ${currentConfig}` : undefined}
      >
         {isEnabled ? (
            <>
               <MenuBarExtra.Item title="Выключить прокси" onAction={() => toggleProxy()} />
               <MenuBarExtra.Section title="Переключить конфиг:">
                  {availableConfigs.map((config) => (
                     <MenuBarExtra.Item
                        key={config}
                        title={`${currentConfig === config.replace('.json', '') ? '⭐ ' : ''}${config}`}
                        onAction={() => toggleProxy(config)}
                        icon={config === prefs.defaultConfig ? Icon.Star : Icon.Document}
                     />
                  ))}
               </MenuBarExtra.Section>
            </>
         ) : (
            <>
               <MenuBarExtra.Item
                  title="Включить прокси (default)"
                  onAction={() => toggleProxy()}
                  tooltip={isTmuxInstalled === false ? "Требуется установить tmux" : undefined}
               />
               {availableConfigs.length > 1 && (
                  <MenuBarExtra.Section title="Выбрать конфиг:">
                     {availableConfigs.map((config) => (
                        <MenuBarExtra.Item
                           key={config}
                           title={config}
                           onAction={() => toggleProxy(config)}
                           icon={config === prefs.defaultConfig ? Icon.Star : Icon.Document}
                        />
                     ))}
                  </MenuBarExtra.Section>
               )}
            </>
         )}

         {isTmuxInstalled === false && (
            <MenuBarExtra.Section title="Информация:">
               <MenuBarExtra.Item title="Tmux не установлен" tooltip="Установите tmux для работы прокси" />
            </MenuBarExtra.Section>
         )}
      </MenuBarExtra>
   );
}
