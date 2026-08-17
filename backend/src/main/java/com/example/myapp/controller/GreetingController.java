package com.example.myapp.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class GreetingController {

    @GetMapping("/api/greet/{name}")
    public Map<String, String> greet(@PathVariable String name) {
        return Map.of("message", "Hello, " + name + "!");
    }
}