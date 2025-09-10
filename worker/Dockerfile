# LOC 1
FROM node:20-bullseye-slim
# LOC 2
RUN apt-get update && apt-get install -y ffmpeg python3 make gcc g++ && rm -rf /var/lib/apt/lists/*
# LOC 3
WORKDIR /app
# LOC 4
COPY package.json bun.lockb ./ 
# LOC 5
RUN npm install --production
# LOC 6
COPY . .
# LOC 7
RUN npm run build || true
# LOC 8
EXPOSE 3000
# LOC 9
CMD ["node", "dist/index.js"]
# LOC 10