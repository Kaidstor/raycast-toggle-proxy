import * as glob from "glob";
import fs from "fs";
import path from "path";
import os from "os";

export interface SshHostEntry {
  host: string;
  hostName?: string;
  user?: string;
  identityFile?: string;
  [key: string]: string | undefined;
}

export function loadFullSshConfig(configPath?: string): SshHostEntry[] {
  if (!configPath) {
    configPath = path.join(os.homedir(), ".ssh", "config");
  }
  const visitedPaths = new Set<string>();
  const allHosts: SshHostEntry[] = [];
  collectHostsRecursive(configPath, allHosts, visitedPaths);
  return allHosts;
}

/**
 * Рекурсивно собирает Host-секции из указанного файла + подключаемых по Include.
 */
function collectHostsRecursive(filePath: string, accumulatedHosts: SshHostEntry[], visitedPaths: Set<string>) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  if (visitedPaths.has(fullPath)) {
    return;
  }
  visitedPaths.add(fullPath);

  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  let currentHost: SshHostEntry | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    // === Обработка Include ===
    // Пример: "Include ~/.ssh/config.d/*"
    if (/^Include\s+/i.test(line)) {
      const includesPart = line.replace(/^Include\s+/i, "").trim();
      // Может быть несколько путей после Include
      const includesList = includesPart.split(/\s+/).filter(Boolean);

      for (const inc of includesList) {
        const resolved = resolveIncludePaths(path.dirname(fullPath), inc);
        for (const incPath of resolved) {
          collectHostsRecursive(incPath, accumulatedHosts, visitedPaths);
        }
      }
      continue;
    }

    // === Обработка Host ===
    if (/^Host\s+/i.test(line)) {
      if (currentHost) {
        accumulatedHosts.push(currentHost);
      }
      const hostName = line.replace(/^Host\s+/i, "").trim();
      // Игнорируем wildcard (*). Можно изменить логику, если хотите
      if (hostName.includes("*")) {
        currentHost = null;
      } else {
        currentHost = { host: hostName };
      }
      continue;
    }

    // === Прочие параметры внутри секции Host ===
    if (!currentHost) {
      // Значит, либо глобальные директивы, либо wildcard Host — пропускаем
      continue;
    }
    const [paramRaw, ...rest] = line.split(/\s+/);
    const param = paramRaw.toLowerCase();
    const value = rest.join(" ");

    switch (param) {
      case "hostname":
        currentHost.hostName = value;
        break;
      case "user":
        currentHost.user = value;
        break;
      case "identityfile":
        currentHost.identityFile = value;
        break;
      default:
        currentHost[param] = value;
    }
  }

  if (currentHost) {
    accumulatedHosts.push(currentHost);
  }
}

/**
 * Разрешаем пути, указанные после `Include`, с учётом:
 *  - Тильды (~/...)
 *  - wildcard-паттернов (*, ?)
 */
function resolveIncludePaths(baseDir: string, incPath: string): string[] {
  // Если путь начинается с ~, заменим на домашнюю директорию
  if (incPath.startsWith("~")) {
    incPath = path.join(os.homedir(), incPath.slice(1));
  }

  // Если путь не абсолютный, дополним его baseDir
  if (!path.isAbsolute(incPath)) {
    incPath = path.join(baseDir, incPath);
  }

  // Проверяем, есть ли wildcard. Если нет, просто вернём как есть
  if (!/[*?]/.test(incPath)) {
    return [incPath];
  }

  // Иначе используем glob для разворачивания шаблона
  return glob.sync(incPath);
}
