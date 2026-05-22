<script setup lang="ts">
const a = 1;
console.log("====================================");
console.log(a);
console.log("====================================");
</script>

<template>
  <router-link to="/">home</router-link>
  <router-link to="/user">user</router-link>
  <router-view />
</template>
