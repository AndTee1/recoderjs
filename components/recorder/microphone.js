/* eslint-disable */
/**
 * License (MIT)
 *
 * Copyright © 2013 Matt Diamond
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
import InlineWorker from 'inline-worker';
// import Encoder from './encoder.js';

const defaultConfig = {
    bufferLen: 4096,
    numChannels: 1,
    mimeType: 'audio/mp3',
};

class Microphone {
    constructor(source, config) {
        this.config = Object.assign({}, defaultConfig, config);
        this.configmp3 = {
            // 128 or 160 kbit/s – mid-range bitrate quality
            bitRate: 128,

            // There is a known issue with some macOS machines, where the recording
            // will sometimes have a loud 'pop' or 'pop-click' sound. This flag
            // prevents getting audio from the microphone a few milliseconds after
            // the begining of the recording. It also helps to remove the mouse
            // "click" sound from the output mp3 file.
            startRecordingAt: 300,
            deviceId: null,
        };
        this.mp3Encoder = null;
        this.lameEncoder=null;
        this.recording = false;
        this.dataBuffer =[];
        this.samplesMono = null;
        this.maxSamples = 1152;
        this.callbacks = {
            getBuffer: [],
            exportWAV: []
        };

        this.context = source.context;
        this.node = (this.context.createScriptProcessor ||
            this.context.createJavaScriptNode).call(this.context,
                this.config.bufferLen, this.config.numChannels, this.config.numChannels);

        this.node.onaudioprocess = (e) => {
            if (!this.recording) return;

            //var buffer = [];
            // for (var channel = 0; channel < this.config.numChannels; channel++) {
                // buffer.push(e.inputBuffer.getChannelData(channel));
                this.encode(e.inputBuffer.getChannelData(0));
            //}
           
            this.worker.postMessage({
                command: 'record',
                buffer: this.dataBuffer
            });
        };

        source.connect(this.node);
        this.node.connect(this.context.destination);    //this should not be necessary

        let self = {};
        
        this.worker = new InlineWorker(function () {
            let recLength = 0,
                recBuffers = [],
                sampleRate,
                numChannels;
            this.onmessage = function (e) {
                switch (e.data.command) {
                    case 'init':
                        init(e.data.config);
                        break;
                    case 'record':
                        record(e.data.buffer);
                        break;
                    case 'exportWAV':
                        exportWAV(e.data.data);
                        break;
                    case 'getBuffer':
                        getBuffer();
                        break;
                    case 'clear':
                        clear();
                        break;
                }
            };

            function init(config) {
                sampleRate = config.sampleRate;
                numChannels = config.numChannels;
                initBuffers();
            }

            function record(inputBuffer) {
                for (var channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel].push(inputBuffer[channel]);
                }
                recLength += inputBuffer[0].length;
            }

            function exportWAV(data) {
                console.log('data',data)
                // let buffers = [];
                // for (let channel = 0; channel < numChannels; channel++) {
                //     buffers.push(mergeBuffers(recBuffers[channel], recLength));
                // }
                // let interleaved;
                // // if (numChannels === 2) {
                // //     interleaved = interleave(buffers[0], buffers[1]);
                // // } else {
                //     interleaved = buffers[0];
                // // }
                // //const finalBuffer = this.finish();

                // // return new Promise((resolve, reject) => {
                // //    if (finalBuffer.length === 0) {
                // //       reject(new Error('No buffer to send'));
                // //    } else {
                // //        resolve([finalBuffer, ]);
                // //        this.lameEncoder.clearBuffer();
                // //    }
                // // });

                // let dataview = encodeWAV(interleaved);
                // let audioBlob = new Blob(finalBuffer, { type: 'audio/mp3' })
                // //let audioBlob = new Blob([dataview], { type: type });

                this.postMessage({ command: 'exportWAV', data: data });
                // clearBuffer();
            }

            function getBuffer() {
                let buffers = [];
                for (let channel = 0; channel < numChannels; channel++) {
                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                }
                this.postMessage({ command: 'getBuffer', data: buffers });
            }

            function clear() {
                recLength = 0;
                recBuffers = [];
                initBuffers();
            }

            function initBuffers() {
                for (let channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel] = [];
                }
            }

            function mergeBuffers(recBuffers, recLength) {
                let result = new Float32Array(recLength);
                let offset = 0;
                for (let i = 0; i < recBuffers.length; i++) {
                    result.set(recBuffers[i], offset);
                    offset += recBuffers[i].length;
                }
                return result;
            }

            function interleave(inputL, inputR) {
                let length = inputL.length + inputR.length;
                let result = new Float32Array(length);

                let index = 0,
                    inputIndex = 0;

                while (index < length) {
                    result[index++] = inputL[inputIndex];
                    result[index++] = inputR[inputIndex];
                    inputIndex++;
                }
                return result;
            }

            function floatTo16BitPCM(output, offset, input) {
                for (let i = 0; i < input.length; i++, offset += 2) {
                    let s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i += 1) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }

            function encodeWAV(samples) {
                const buffer = new ArrayBuffer(44 + (samples.length * 2));
                const view = new DataView(buffer);

                /* RIFF identifier */
                writeString(view, 0, 'RIFF');
                /* RIFF chunk length */
                view.setUint32(4, 36 + (samples.length * 2), true);
                /* RIFF type */
                writeString(view, 8, 'WAVE');
                /* format chunk identifier */
                writeString(view, 12, 'fmt ');
                /* format chunk length */
                view.setUint32(16, 16, true);
                /* sample format (raw) */
                view.setUint16(20, 1, true);
                /* channel count */
                view.setUint16(22, numChannels, true);
                /* sample rate */
                view.setUint32(24, sampleRate, true);
                /* byte rate (sample rate * block align) */
                view.setUint32(28, sampleRate * 4, true);
                /* block align (channel count * bytes per sample) */
                view.setUint16(32, numChannels * 2, true);
                /* bits per sample */
                view.setUint16(34, 16, true);
                /* data chunk identifier */
                writeString(view, 36, 'data');
                /* data chunk length */
                view.setUint32(40, samples.length * 2, true);

                floatTo16BitPCM(view, 44, samples);

                return view;
            }
        }, self);

        this.worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                numChannels: this.config.numChannels,
            },
        });

        this.worker.onmessage = (e) => {
            const cb = this.callbacks[e.data.command].pop();
            if (typeof cb === 'function') {
                cb(e.data.data);
            }
        };
    }


    record() {
        this.recording = true;
        const lamejs = require('lamejs')
        this.mp3Encoder = new lamejs.Mp3Encoder(
            1,
            16000,
            128
        )
        
    }

    stop() {
        this.recording = false;
    }

    clear() {
        this.worker.postMessage({ command: 'clear' });
    }

    getBuffer(cb) {
        cb = cb || this.config.callback;

        if (!cb) throw new Error('Callback not set');

        this.callbacks.getBuffer.push(cb);

        this.worker.postMessage({ command: 'getBuffer' });
    }

    exportWAV(cb, mimeType) {
        mimeType = mimeType || this.config.mimeType;
        cb = cb || this.config.callback;

        if (!cb) throw new Error('Callback not set');

        this.callbacks.exportWAV.push(cb);

        // this.worker.postMessage({
        //     command: 'exportWAV',
        //     type: mimeType,
        // });
        const finalBuffer = this.finish();
        
        // return new Promise((resolve, reject) => {
        //    if (finalBuffer.length === 0) {
        //       reject(new Error('No buffer to send'));
        //    } else {
        //        resolve([finalBuffer, ]);
        //        this.lameEncoder.clearBuffer();
        //    }
        // });

        //let dataview = encodeWAV(interleaved);
        let audioBlob = new Blob(finalBuffer, { type: 'audio/mp3' })
        // console.log(audioBlob)
        // const audioUrl = URL.createObjectURL(audioBlob)
        // console.log(audioUrl)
        //let audioBlob = new Blob([dataview], { type: type });
        // return audioBlob
        this.worker.postMessage({ command: 'exportWAV', data: audioBlob });
    }
    clearBuffer() {
        this.dataBuffer = []
    }

    /**
     * Append new audio buffer to current active buffer
     * @param {Buffer} buffer
     */
    appendToBuffer(buffer) {
        this.dataBuffer.push(new Int8Array(buffer))
    }

    /**
     * Float current data to 16 bits PCM
     * @param {Float32Array} input
     * @param {Int16Array} output
     */
    floatTo16BitPCM(input, output) {
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]))
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            //output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    /**
     * Convert buffer to proper format
     * @param {Array} arrayBuffer
     */
    convertBuffer(arrayBuffer) {
        const data = new Float32Array(arrayBuffer)
        const out = new Int16Array(arrayBuffer.length)
        this.floatTo16BitPCM(data, out)

        return out
    }

    /**
     * Encode and append current buffer to dataBuffer
     * @param {Array} arrayBuffer
     */
    encode(arrayBuffer) {
        // this.mp3Encoder = new lamejs.Mp3Encoder(
        //     1,
        //     this.config.sampleRate,
        //     this.config.bitRate
        // )
        
        this.samplesMono = this.convertBuffer(arrayBuffer)
        let remaining = this.samplesMono.length
        for (let i = 0; remaining >= 0; i += this.maxSamples) {
            const left = this.samplesMono.subarray(i, i + this.maxSamples)
            // console.log(left)
            const mp3buffer = this.mp3Encoder.encodeBuffer(left)
            this.appendToBuffer(mp3buffer)
            
            remaining -= this.maxSamples
        }
        
    }

    /**
     * Return full dataBuffer
     */
    finish() {
         this.appendToBuffer(this.mp3Encoder.flush())

        return this.dataBuffer
    }
}

Microphone.forceDownload = function forceDownload(blob, filename) {
    const a = document.createElement('a');

    a.style = 'display: none';
    document.body.appendChild(a);

    var url = window.URL.createObjectURL(blob);

    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);

    document.body.removeChild(a);
};

export default Microphone;