package com.example.myapp;

import com.example.myapp.model.Task;
import com.example.myapp.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MongoDBContainer;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataMongoTest
class TaskRepositoryTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class MongoContainerConfig {
        @Bean
        @ServiceConnection
        MongoDBContainer mongoDbContainer() {
            return new MongoDBContainer("mongo:8");
        }
    }

    @Autowired
    private TaskRepository taskRepository;

    @Test
    void savesAndRetrievesATask() {
        Task saved = taskRepository.save(new Task("Write backend tests", false));

        Optional<Task> found = taskRepository.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Write backend tests");
    }
}

