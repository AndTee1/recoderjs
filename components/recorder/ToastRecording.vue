<template>
  <div>
    <div class="toast" :class="place">
      <div class="">
        <div class="flex justify-between">
          <div class="flex">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="title">
              {{ title }}
            </div>
          </div>
          <div class="title">
            {{ hour }}:{{ minute > 9 ? minute : "0" + minute }}:{{
              seconds > 9 ? seconds : "0" + seconds
            }}
          </div>
        </div>
      </div>
      <div class="container">
        <div
          v-for="(item, index) in data"
          :key="index"
          class="sigla"
          :style="item"
        ></div>
      </div>
      <div v-if="!upload" class="flex justify-between">
        <button class="button-pause" @click="pauseAndcontinue()">
          {{ isPause ? titleContinue : titlePause }}
        </button>
        <button class="button-primary" @click="stop()">
          {{ titleDone }}
        </button>
      </div>
      <div v-else class="loading title">
        Đang tải file lên
        <div class="dot-flashing"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    data: {
      type: Array,
      default: () => {},
    },
    title: {
      type: String,
      default: "",
    },
    titlePause: {
      type: String,
      default: "Tạm dừng",
    },
    titleContinue: {
      type: String,
      default: "Tiếp tục",
    },
    titleDone: {
      type: String,
      default: "Xong",
    },
    hour: {
      type: Number,
      default: 0,
    },
    minute: {
      type: Number,
      default: 0,
    },
    seconds: {
      type: Number,
      default: 0,
    },
    place: {
      type: String,
      default: "bottom-right",
    },
  },
  data() {
    return {
      isPause: false,
      upload: false,
    };
  },
  created() {
    // eslint-disable-next-line nuxt/no-globals-in-created
    window.addEventListener("beforeunload", this.handler);
  },
  beforeDestroy() {
    window.removeEventListener("beforeunload", this.handler);
    this.upload = false;
  },

  methods: {
    handler(event) {
      // Do Something
      event.preventDefault();
      event.returnValue = "";
    },
    pauseAndcontinue() {
      if (!this.isPause) {
        this.isPause = true;
        this.$emit("pause");
      } else {
        this.isPause = false;
        this.$emit("continue");
      }
    },
    stop() {
      this.upload = true;
      this.$emit("stop");
    },
  },
};
</script>

<style scoped>
.flex {
  display: flex;
}
.justify-between {
  justify-content: space-between;
}
.sigla {
  width: 5px;
  background: #6054ed;
  margin: 0px 2px;
}
.container {
  height: 35px;
  transform: rotate(180deg);
  display: flex;
}
.top {
  top: 10px;
  right: 40%;
}
.bottom {
  bottom: 10px;
  right: 40%;
}
.top-left {
  top: 20px;
  left: 20px;
}
.bottom-left {
  bottom: 20px;
  left: 20px;
}
.top-right {
  top: 20px;
  right: 20px;
}
.bottom-right {
  bottom: 20px;
  right: 20px;
}
.toast {
  position: fixed;
  background: #ffffff;
  border: 1px solid #f1f1f1;
  border-radius: 8px;
  padding: 10px 20px;
  color: #6054ed;
  z-index: 9999;
  box-shadow: inset 0 -3em 3em rgba(0, 0, 0, 0.1), 0 0 0 2px rgb(255, 255, 255),
    0.3em 0.3em 1em rgba(0, 0, 0, 0.3);
}
.button-primary {
  background: #6054ed;
  color: #ffffff;
  padding: 5px 10px;
  margin-top: 10px;
  border: none;
  border-radius: 8px;
}
.button-pause {
  background: #c7c3f9;
  color: #000000;
  padding: 5px 10px;
  margin-top: 10px;
  border: none;
  border-radius: 8px;
}
.title {
  font-family: "HarmonyOS Sans SC";
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 22px;
  margin: 0px 5px;
}
.loading {
  margin: 5px 0px 0px 0px;
  display: flex;
}
.dot-flashing {
  position: relative;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: #6054ed;
  color: #6054ed;
  animation: dot-flashing 1s infinite linear alternate;
  animation-delay: 0.5s;
  top: 9px;
  left: 20px;
}
.dot-flashing::before,
.dot-flashing::after {
  content: "";
  display: inline-block;
  position: absolute;
  top: 0;
}
.dot-flashing::before {
  left: -10px;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: #6054ed;
  color: #6054ed;
  animation: dot-flashing 1s infinite alternate;
  animation-delay: 0s;
}
.dot-flashing::after {
  left: 10px;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  background-color: #6054ed;
  color: #6054ed;
  animation: dot-flashing 1s infinite alternate;
  animation-delay: 1s;
}

@keyframes dot-flashing {
  0% {
    background-color: #9880ff;
  }
  50%,
  100% {
    background-color: rgba(152, 128, 255, 0.2);
  }
}
</style>
