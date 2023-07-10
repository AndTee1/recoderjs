<template>
  <div class="">
    <button
      :disabled="isRecording"
      class="button-recoder"
      :class="classbtn"
      @click="startRecording"
    >
      <slot name="icon"></slot>
      <slot name="text"></slot>
    </button>
    <Recording
      v-if="isRecording"
      :place="place"
      title="Đang ghi âm"
      :data="barcode()"
      :seconds="seconds"
      :minute="minute"
      :hour="hour"
      @stop="stopRecording"
      @pause="pauseRecording"
      @continue="continueRecording"
    />
    <!-- <div v-for="(audio, index) in recordedAudio" :key="index">
      <audio id="audio" :src="audio.url" controls></audio>
      <a :href="audio.url" :download="getFileName(audio.url)">Download</a>
    </div> -->
  </div>
</template>

<script>
import { uuid } from "uuidv4";
import Recorder from "./record.js";
import Recording from "./ToastRecording.vue";
export default {
  components: {
    Recording,
  },
  props: {
    classbtn: {
      type: String,
      default: "",
    },
    place: {
      type: String,
      default: "bottom-right",
    },
  },
  data() {
    return {
      recorder: null,
      isRecording: false,
      recordedAudio: [],
      audioContext: null,
      analyzeData: {
        data: [],
        lineTo: 254,
      },
      data: [],
      mediaStream: null,
      seconds: 0,
      minute: 0,
      hour: 0,
      timerInterval: null,
      audioBackup: {
        blob: null,
        buffer: null,
      },
      pasuing: false,
      startDate: null,
      distance: null,
      setTime: null,
    };
  },
  mounted() {},
  methods: {
    async initAudio() {
      // const time = new Date().getTime()
      if (!this.setTime) {
        this.setTime = new Date().getTime();
      }
      this.audioContext = new window.AudioContext({
        sampleRate: 16000,
      });
      this.recorder = new Recorder(this.audioContext, {
        // An array of 255 Numbers
        // You can use this to visualize the audio stream
        // If you use react, check out react-wave-stream
        // @ts-ignore
        onAnalysed: (data) => this.setTimeUpdate(data, this.setTime),
      });
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        return this.recorder.init(this.mediaStream);
      } catch (e) {
        alert(e.message);
      }
    },
    setTimeUpdate(data, time) {
      const now = new Date().getTime();
      const timeout = now - time;
      if (timeout > 100) {
        this.analyzeData = data;
        this.setTime = new Date().getTime();
      }
    },
    chunkArray(array, chunkSize) {
      const chunks = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    },
    barcode() {
      const maxBarHeight = 25;
      const chunkSize = Math.ceil(this.analyzeData.data.length / 25);
      const chunks = this.chunkArray(this.analyzeData.data, chunkSize);

      const averages = chunks.map((chunk) => {
        // @ts-ignore
        const sum = chunk.reduce((a, b) => a + b, 0);
        return sum / chunk.length;
      });

      const maxHeight = Math.max(...averages);
      const barHeightFactor = maxBarHeight / maxHeight;
      if (this.pasuing) {
        return [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0,
        ];
      }
      return averages
        .map((value) => {
          const height = value * barHeightFactor;
          return { height: `${height}px` };
        })
        .reverse();
    },

    async startRecording() {
      await this.initAudio();
      this.startDate = new Date().getTime();
      this.recorder.start().then((...args) => {
        this.isRecording = true;
        this.timerInterval = setInterval(() => {
          this.getRealtimeRecord();
        }, 1000);
      });
      this.$emit("recording", true);
    },
    pauseRecording() {
      clearInterval(this.timerInterval);
      const now = new Date().getTime();
      this.distance = now - this.startDate + this.distance;
      this.recorder.pause();
      this.pasuing = true;
    },
    getRealtimeRecord() {
      const now = new Date().getTime();
      const distance2 = now - this.startDate + this.distance;
      this.hour = Math.floor(
        (distance2 % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
      );
      this.minute = Math.floor((distance2 % (60 * 60 * 1000)) / (60 * 1000));
      this.seconds = Math.floor((distance2 % (60 * 1000)) / 1000);
    },
    continueRecording() {
      this.recorder.resume();
      this.pasuing = false;
      this.startDate = new Date().getTime();
      this.getRealtimeRecord();
      this.timerInterval = setInterval(() => {
        this.getRealtimeRecord();
      }, 1000);
    },
    stopRecording() {
      if (this.recorder && this.isRecording) {
        this.recorder
          .stop()
          .then(({ blob, buffer }) => {
            console.log(blob, buffer);
            const audioUrl = URL.createObjectURL(blob);
            console.log(audioUrl);
            // this.recordedAudio.push({ url: audioUrl, buffer })
            //
            this.mediaStream.getTracks().forEach((track) => track.stop());
            clearInterval(this.timerInterval);
            this.duration = 0;

            // Send the FormData using Axios
            // const data = await this.convertWavToMp3(blob)
            // console.log(data, url)
            this.$emit(
              "doneaudio",
              {
                name: "recording.mp3",
                raw: this.blobToFile(blob, "recording.mp3"),
                size: blob.size,
                uid: this.blobToFile(blob, "recording.mp3").uid,
                percentage: 100,
                status: "success",
              },
              blob
            );
            this.isRecording = false;
            this.setbaseValue();
          })
          .catch((error) => {
            console.error("Error stopping recording:", error);
          });
      }
      this.$emit("recording", false);
    },
    setbaseValue() {
      this.distance = null;
      this.startDate = null;
      this.hour = 0;
      this.minute = 0;
      this.seconds = 0;
    },
    getFileName(url) {
      const startIndex = url.lastIndexOf("/") + 1;
      return url.substring(startIndex);
    },
    blobToFile(blob, fileName) {
      // Create a new File object
      const file = new File([blob], fileName, { type: blob.type });
      file.uid = uuid();
      return file;
    },
  },
};
</script>

<style scoped>
.button-recoder {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px 16px;
  border: none;
  color: white;
  margin: 0px 8px;

  /* Primary/Dark */

  background: #6054ed;
  border-radius: 40px;
  .icon {
    padding: 8px;
    background: #6054ed;
    border-radius: 40px;
  }
  &:disabled {
    //color: #898989 !important;
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
