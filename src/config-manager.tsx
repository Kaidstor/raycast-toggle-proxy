import {
   ActionPanel,
   Action,
   List,
   Detail,
   Form,
   showToast,
   Toast,
   getPreferenceValues,
   Icon,
   confirmAlert,
   Alert
} from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

type Preferences = {
   xrayPath?: string;
   defaultConfig?: string;
};

interface ConfigItem {
   name: string;
   path: string;
   isDefault: boolean;
   exists: boolean;
   size?: number;
   modified?: Date;
}

export default function ConfigManager() {
   const prefs = getPreferenceValues<Preferences>();
   const [configs, setConfigs] = useState<ConfigItem[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   function getXrayPath(): string {
      const xrayPath = prefs.xrayPath || "~/xray";
      return xrayPath.startsWith("~") ? path.join(os.homedir(), xrayPath.slice(1)) : xrayPath;
   }

   function getSavedConfigNames(): string[] {
      const configs = [];

      if (prefs.defaultConfig) {
         configs.push(prefs.defaultConfig);
      }

      return configs.length > 0 ? configs : ['config.json'];
   }

   function loadConfigs() {
      setIsLoading(true);
      const xrayPath = getXrayPath();
      const savedConfigNames = getSavedConfigNames();
      const configItems: ConfigItem[] = [];

      // Check saved configs
      for (const configName of savedConfigNames) {
         const configPath = path.join(xrayPath, configName);
         let exists = false;
         let size: number | undefined;
         let modified: Date | undefined;

         try {
            const stats = fs.statSync(configPath);
            exists = true;
            size = stats.size;
            modified = stats.mtime;
         } catch (error) {
            exists = false;
         }

         configItems.push({
            name: configName,
            path: configPath,
            isDefault: configName === prefs.defaultConfig,
            exists,
            size,
            modified
         });
      }

      // Check for other JSON files in the directory
      try {
         if (fs.existsSync(xrayPath)) {
            const files = fs.readdirSync(xrayPath)
               .filter(file => file.endsWith('.json'))
               .filter(file => !savedConfigNames.includes(file));

            for (const file of files) {
               const configPath = path.join(xrayPath, file);
               try {
                  const stats = fs.statSync(configPath);
                  configItems.push({
                     name: file,
                     path: configPath,
                     isDefault: false,
                     exists: true,
                     size: stats.size,
                     modified: stats.mtime
                  });
               } catch (error) {
                  // Skip files that can't be read
               }
            }
         }
      } catch (error) {
         console.log("Error reading directory:", error);
      }

      setConfigs(configItems);
      setIsLoading(false);
   }

   useEffect(() => {
      loadConfigs();
   }, []);

   function ConfigDetailView({ config }: { config: ConfigItem }) {
      const [content, setContent] = useState<string>("");
      const [isEditing, setIsEditing] = useState(false);
      const [editedContent, setEditedContent] = useState<string>("");

      useEffect(() => {
         if (config.exists) {
            try {
               const fileContent = fs.readFileSync(config.path, 'utf8');
               setContent(fileContent);
               setEditedContent(fileContent);
            } catch (error) {
               setContent(`Ошибка чтения файла: ${(error as Error).message}`);
            }
         }
      }, [config]);

      const handleSave = () => {
         try {
            fs.writeFileSync(config.path, editedContent, 'utf8');
            setContent(editedContent);
            setIsEditing(false);
            showToast(Toast.Style.Success, "Конфиг сохранён");
            loadConfigs(); // Refresh the list
         } catch (error) {
            showToast(Toast.Style.Failure, `Ошибка сохранения: ${(error as Error).message}`);
         }
      };

      const handleDelete = async () => {
         const confirmed = await confirmAlert({
            title: "Удалить конфиг?",
            message: `Вы уверены, что хотите удалить ${config.name}?`,
            primaryAction: {
               title: "Удалить",
               style: Alert.ActionStyle.Destructive,
            },
         });

         if (confirmed) {
            try {
               fs.unlinkSync(config.path);
               showToast(Toast.Style.Success, "Конфиг удалён");
               loadConfigs();
            } catch (error) {
               showToast(Toast.Style.Failure, `Ошибка удаления: ${(error as Error).message}`);
            }
         }
      };

      if (isEditing) {
         return (
            <Form
               actions={
                  <ActionPanel>
                     <Action title="Сохранить" onAction={handleSave} />
                     <Action title="Отменить" onAction={() => setIsEditing(false)} />
                  </ActionPanel>
               }
            >
               <Form.TextArea
                  id="content"
                  title="Содержимое конфига"
                  value={editedContent}
                  onChange={setEditedContent}
               />
            </Form>
         );
      }

      const markdown = config.exists
         ? `# ${config.name}\n\n**Путь:** \`${config.path}\`\n**Размер:** ${config.size} bytes\n**Изменён:** ${config.modified?.toLocaleString()}\n\n\`\`\`json\n${content}\n\`\`\``
         : `# ${config.name}\n\n**Файл не найден:** \`${config.path}\``;

      return (
         <Detail
            markdown={markdown}
            actions={
               <ActionPanel>
                  {config.exists && (
                     <>
                        <Action title="Редактировать" onAction={() => setIsEditing(true)} icon={Icon.Pencil} />
                        <Action.CopyToClipboard title="Скопировать содержимое" content={content} />
                        <Action.OpenWith title="Открыть в редакторе" path={config.path} />
                        <Action title="Удалить" onAction={handleDelete} icon={Icon.Trash} style={Action.Style.Destructive} />
                     </>
                  )}
                  <Action.OpenWith title="Открыть папку" path={path.dirname(config.path)} />
                  <Action title="Обновить" onAction={loadConfigs} icon={Icon.ArrowClockwise} />
               </ActionPanel>
            }
         />
      );
   }

   return (
      <List isLoading={isLoading} searchBarPlaceholder="Поиск конфигов...">
         {configs.map((config) => (
            <List.Item
               key={config.name}
               title={config.name}
               subtitle={config.exists ? `${config.size} bytes` : "Файл не найден"}
               accessories={[
                  ...(config.isDefault ? [{ text: "Default", icon: Icon.Star }] : []),
                  ...(config.modified ? [{ date: config.modified }] : []),
                  { icon: config.exists ? Icon.CheckCircle : Icon.XMarkCircle }
               ]}
               actions={
                  <ActionPanel>
                     <Action.Push
                        title="Показать детали"
                        target={<ConfigDetailView config={config} />}
                        icon={Icon.Eye}
                     />
                     {config.exists && (
                        <>
                           <Action.CopyToClipboard
                              title="Скопировать путь"
                              content={config.path}
                              shortcut={{ modifiers: ["cmd"], key: "c" }}
                           />
                           <Action.OpenWith
                              title="Открыть в редакторе"
                              path={config.path}
                              shortcut={{ modifiers: ["cmd"], key: "o" }}
                           />
                        </>
                     )}
                     <Action.OpenWith
                        title="Открыть папку"
                        path={path.dirname(config.path)}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                     />
                     <Action
                        title="Обновить список"
                        onAction={loadConfigs}
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                     />
                  </ActionPanel>
               }
            />
         ))}
         {configs.length === 0 && (
            <List.EmptyView
               title="Конфиги не найдены"
               description="Добавьте конфиги в настройки или создайте файлы в папке Xray"
               actions={
                  <ActionPanel>
                     <Action.OpenWith title="Открыть папку Xray" path={getXrayPath()} />
                  </ActionPanel>
               }
            />
         )}
      </List>
   );
} 