#!/usr/bin/env node
/**
 * One-time script to download and prepare CIFAR-10 binary files.
 * Run: node scripts/prepare-cifar10.js
 * Output: public/datasets/cifar10/cifar10_train.bin (50,000 records)
 *         public/datasets/cifar10/cifar10_test.bin  (10,000 records)
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const CIFAR10_URL = "https://www.cs.toronto.edu/~kriz/cifar-10-binary.tar.gz";
const OUT_DIR = path.join(__dirname, "../public/datasets/cifar10");

function download(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		https
			.get(url, (res) => {
				if (res.statusCode === 301 || res.statusCode === 302) {
					file.close();
					fs.unlinkSync(dest);
					download(res.headers.location, dest).then(resolve).catch(reject);
					return;
				}
				if (res.statusCode !== 200) {
					file.close();
					reject(new Error(`HTTP ${res.statusCode}`));
					return;
				}
				res.pipe(file);
				file.on("finish", () => file.close(resolve));
			})
			.on("error", reject);
	});
}

async function main() {
	fs.mkdirSync(OUT_DIR, { recursive: true });

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cifar10-"));
	const tarPath = path.join(tmpDir, "cifar10.tar.gz");

	console.log("Downloading CIFAR-10 binary format from toronto.edu...");
	await download(CIFAR10_URL, tarPath);
	console.log("Extracting...");
	execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`);

	const batchDir = path.join(tmpDir, "cifar-10-batches-bin");

	console.log("Merging 5 training batches...");
	const trainPath = path.join(OUT_DIR, "cifar10_train.bin");
	const trainOut = fs.createWriteStream(trainPath);
	await new Promise((resolve, reject) => {
		let i = 1;
		function writeNext() {
			if (i > 5) {
				trainOut.end();
				trainOut.on("finish", resolve);
				return;
			}
			const data = fs.readFileSync(path.join(batchDir, `data_batch_${i}.bin`));
			trainOut.write(data, () => {
				i++;
				writeNext();
			});
		}
		writeNext();
		trainOut.on("error", reject);
	});

	console.log("Copying test batch...");
	fs.copyFileSync(
		path.join(batchDir, "test_batch.bin"),
		path.join(OUT_DIR, "cifar10_test.bin"),
	);

	fs.rmSync(tmpDir, { recursive: true });

	const trainSize = fs.statSync(trainPath).size;
	console.log(`Done! Training: ${(trainSize / 1e6).toFixed(1)} MB`);
	console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
