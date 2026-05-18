<script setup>
import { watch, toRef } from "vue";
import Icon from "./Icon.vue";
import { useQualityCheckModal } from "../composables/useQualityCheckModal.js";
import "../styles/quality-check-modal.css";

const props = defineProps({
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  outline: { type: Array, required: true },
  isGeneratingContent: { type: Boolean, default: false },
  fullMarkdown: { type: String, default: "" },
});

const emit = defineEmits(["show-toast"]);

const {
  showQualityCheck,
  qualityCheckLoading,
  qualityCheckError,
  showLoadingState,
  visibleItems,
  qualityResults,
  qualityScores,
  totalScore,
  totalComment,
  visibleTotalScore,
  progressBarWidth,
  currentStep,
  visibleSuggestions,
  visibleSuggestionItems,
  suggestions,
  canShowQualityReport,
  loadQualityCheckRecord,
  startQualityCheck,
  closeQualityCheck,
  getTotalScoreColor,
  getScoreClass,
  dimensions,
  visibleQualityItems,
  visibleSuggestionList,
  isMobile,
} = useQualityCheckModal({
  projectId: toRef(props, "projectId"),
  projectName: toRef(props, "projectName"),
  outline: toRef(props, "outline"),
  isGeneratingContent: toRef(props, "isGeneratingContent"),
  fullMarkdown: toRef(props, "fullMarkdown"),
  emit,
});

watch(
  () => props.projectId,
  () => {
    loadQualityCheckRecord();
  },
  { immediate: true },
);

defineExpose({
  startQualityCheck,
  canShowQualityReport,
  qualityCheckLoading,
});
</script>

<template>
  <Teleport to="body">
    <div v-if="showQualityCheck" class="quality-modal-overlay">
      <div :class="['quality-modal-content', { 'is-mobile': isMobile }]">
        <div class="modal-header">
          <h2>智能文章质检</h2>
          <button class="close-btn" @click="closeQualityCheck">
            <Icon name="X" :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <Transition name="fade" mode="out-in">
            <div v-if="showLoadingState" key="loading" class="loading-state">
              <div class="loading-icon">
                <Icon name="Loader2" :size="48" class="spinner" />
              </div>
              <p class="loading-text">正在读取文章内容</p>
              <p class="loading-subtext">AI正在分析您的文章...</p>
            </div>

            <div v-else key="quality" class="quality-list">
              <div v-if="qualityCheckError" class="quality-error-message">
                <Icon name="AlertCircle" :size="18" />
                <span>{{ qualityCheckError }}</span>
              </div>
              <template v-else>
                <TransitionGroup name="slide-fade">
                  <div
                    v-for="item in visibleQualityItems"
                    :key="item.dim.key"
                    class="quality-item"
                  >
                    <div class="quality-item-left">
                      <div
                        class="quality-icon"
                        :class="{
                          loading: currentStep === item.index,
                          done: currentStep > item.index,
                        }"
                      >
                        <Icon
                          v-if="currentStep > item.index"
                          name="CheckCircle"
                          :size="20"
                        />
                        <Icon
                          v-else
                          name="Loader2"
                          :size="20"
                          :class="{ spinner: currentStep >= 0 }"
                        />
                      </div>
                      <span class="quality-name">{{ item.dim.name }}</span>
                    </div>
                    <div :class="['quality-result', { 'mobile-full-text': isMobile }]">
                      <span :class="['quality-result-content', { 'mobile-unclamp': isMobile }]">{{
                        qualityResults[item.dim.key]
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores[item.dim.key])"
                    >
                      {{ qualityScores[item.dim.key]
                      }}<span class="score-total">/20</span>
                    </div>
                  </div>
                </TransitionGroup>

                <Transition name="fade">
                  <div v-if="visibleTotalScore" class="total-score-section">
                    <div class="total-score-header">
                      <span class="total-score-label">总分</span>
                      <span
                        class="total-score-value"
                        :style="{ color: getTotalScoreColor(totalScore) }"
                      >
                        {{ totalScore }}/100
                      </span>
                    </div>
                    <div class="total-score-progress">
                      <div
                        class="total-score-progress-bar"
                        :style="{
                          width: `${progressBarWidth}%`,
                          backgroundColor: getTotalScoreColor(totalScore),
                        }"
                      ></div>
                    </div>
                    <div class="total-score-comment">{{ totalComment }}</div>
                  </div>
                </Transition>

                <Transition name="fade">
                  <div v-if="visibleSuggestions" class="suggestions-section">
                    <h3 class="suggestions-title">修改建议</h3>
                    <TransitionGroup name="slide-fade">
                      <div
                        v-for="item in visibleSuggestionList"
                        :key="item.index"
                        class="suggestion-item"
                      >
                        <span class="suggestion-icon">{{
                          item.suggestion.icon
                        }}</span>
                        <div class="suggestion-content">
                          <div
                            v-if="item.suggestion.hasIssue"
                            class="suggestion-issue"
                          >
                            <span class="suggestion-label">问题：</span>
                            <span class="suggestion-value">{{
                              item.suggestion.issue
                            }}</span>
                          </div>
                          <div class="suggestion-text">
                            <span class="suggestion-label">建议：</span>
                            <span class="suggestion-value">{{
                              item.suggestion.text
                            }}</span>
                          </div>
                          <div
                            v-if="item.suggestion.hasExample"
                            class="suggestion-example"
                          >
                            <span class="suggestion-label">示例：</span>
                            <span class="suggestion-value">{{
                              item.suggestion.example
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </TransitionGroup>
                  </div>
                </Transition>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>
