<script setup lang="ts">
import { useAppStore } from '../stores';

const appStore = useAppStore();
</script>

<template>
  <div>
    <h1>Home</h1>
    is loading: {{ appStore.loading }}
    <button @click="appStore.setLoading(!appStore.loading)">
      Toggle Loading
    </button>
  </div>
</template>
