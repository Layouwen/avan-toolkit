<script setup lang="ts">
</script>

<template>
  <nav>
    <router-link to="/">Home</router-link> |
    <router-link to="/sync">博客同步</router-link> |
    <router-link to="/user">用户信息</router-link>
  </nav>
  <div class="app">
    <router-view />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
  background: #121212;
  color: #e0e0e0;
}

.app {
  height: 100%;
}
</style>
