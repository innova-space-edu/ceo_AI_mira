// -----------------------------------------------------
// Silero TTS Engine
// Carga modelo ONNX + genera audio PCM y WAV
// -----------------------------------------------------

class SileroEngine {
    constructor(modelUrl) {
        this.modelUrl = modelUrl;
        this.session = null;
        this.sampleRate = 48000;
        this.modelReady = false;
    }

    async loadModel() {
        if (this.modelReady) return;

        console.log("🔵 Cargando modelo Silero TTS desde:", this.modelUrl);

        this.session = await ort.InferenceSession.create(this.modelUrl, {
            executionProviders: ["wasm"],
        });

        this.modelReady = true;
        console.log("✅ Modelo Silero listo");
    }

    async synthesize(text, speaker = 0) {
        if (!this.modelReady) await this.loadModel();

        const input = new ort.Tensor("string", [text]);
        const spk = new ort.Tensor("int64", BigInt(speaker));

        const output = await this.session.run({
            text: input,
            speaker_id: spk,
        });

        const pcm = output.audio.data; // Float32Array

        return this.encodeWav(pcm, this.sampleRate);
    }

    encodeWav(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // Header WAV standard
        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, "RIFF");
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, samples.length * 2, true);

        // PCM
        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }

        return buffer;
    }
}

window.SileroEngine = SileroEngine;
