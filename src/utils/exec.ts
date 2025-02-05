
import { execaCommand } from "execa";
import * as dotenv from "dotenv";

dotenv.config( {
   path: "~/Documents/raycast/toggle_proxy/toggle-proxy/.env"
});

export async function tmux(command: string) {
   const result = await execaCommand(`tmux ${command}`, { shell: true });

   return result;
}