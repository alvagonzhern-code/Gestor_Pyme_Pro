import { spawn } from "node:child_process";

const commands = [
  ["API", ["run", "dev", "-w", "@gestor-pyme/api"]],
  ["WEB", ["run", "dev", "-w", "@gestor-pyme/web"]],
];

const children = commands.map(([name, args]) => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });
  child.stdout.on("data", (chunk) =>
    process.stdout.write(`[${name}] ${chunk}`),
  );
  child.stderr.on("data", (chunk) =>
    process.stderr.write(`[${name}] ${chunk}`),
  );
  return child;
});

function stop(signal = "SIGTERM") {
  for (const child of children) child.kill(signal);
}

process.on("SIGINT", () => {
  stop("SIGINT");
  process.exit(130);
});
process.on("SIGTERM", () => {
  stop("SIGTERM");
  process.exit(143);
});

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exit(code);
    }
  });
}
