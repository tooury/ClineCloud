# AI Agent Development Instructions - Cline Remote Access System

## Agent Mission

Your mission is to develop the Cline Remote Access System, enabling users to remotely interact with their Cline AI agents through a web-based interface. This system will extend Cline's existing plan/act mode functionality to work seamlessly across devices, providing real-time communication and agent management capabilities.

### Expected Outcomes and Quality Standards
- **Functional Excellence**: Users can remotely chat with agents, monitor progress, and approve actions with full feature parity to the VS Code extension
- **Performance Standards**: <200ms latency for real-time communication, <2s page load times, 99.9% uptime
- **Security Requirements**: Zero unauthorized access incidents, comprehensive audit logging, end-to-end encryption
- **Code Quality**: 90%+ test coverage, strict TypeScript compliance, comprehensive documentation
- **User Experience**: Intuitive interface that works seamlessly on desktop and mobile devices

## How to Use This System

### Checklist Management
- **Primary Reference**: Use `DEVELOPMENT_CHECKLIST.md` as your main task tracking document
- **Progress Updates**: Update checklist status after completing each task by marking items as `[x]`
- **Dependencies**: Always check task dependencies before starting work
- **Quality Gates**: Ensure all acceptance criteria are met before marking tasks complete

### Task Selection Protocol
1. **Check Dependencies**: Verify all prerequisite tasks are completed
2. **Review Requirements**: Read detailed requirements and acceptance criteria
3. **Assess Complexity**: Estimate effort and identify potential blockers
4. **Select Next Task**: Choose the highest priority unblocked task from the checklist
5. **Document Progress**: Update checklist status as you work

### Progress Update Protocol
- **Start of Work Session**: Review current progress and identify next tasks
- **During Development**: Update checklist items as you complete them
- **End of Work Session**: Ensure all completed tasks are properly marked and documented
- **Blocker Reporting**: Immediately document any blockers preventing progress

## Development Guidelines

### Code Quality Standards
- **TypeScript**: Use strict mode with comprehensive type definitions
- **ESLint/Prettier**: Follow existing Cline code formatting rules
- **Error Handling**: Implement comprehensive error handling with proper logging
- **Security**: Follow security-first development principles
- **Performance**: Optimize for sub-second response times

### Architecture Principles
- **Leverage Existing Patterns**: Use established Cline patterns (AuthHandler, message passing)
- **Maintain Compatibility**: Ensure no breaking changes to existing Cline functionality
- **Asynchronous Design**: Use non-blocking operations to prevent UI freezing
- **Modular Structure**: Create loosely coupled, highly cohesive components
- **Event-Driven Architecture**: Use event systems for component communication

### File Organization
```
cline/src/services/remote-access/
├── RemoteAccessServer.ts
├── RemoteMessageBridge.ts
├── RemoteSessionManager.ts
└── types/
    ├── RemoteMessage.ts
    ├── Session.ts
    └── Auth.ts

cline/webview-ui-remote/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── package.json
└── vite.config.ts
```

## Workflow Integration

### Starting Work Session
1. **Review Progress**: Check `DEVELOPMENT_CHECKLIST.md` for current status
2. **Identify Next Task**: Select the highest priority unblocked task
3. **Understand Requirements**: Read detailed requirements and acceptance criteria
4. **Plan Approach**: Break down task into implementation steps
5. **Begin Development**: Start coding following established patterns

### During Development
1. **Follow Patterns**: Use existing Cline code patterns and conventions
2. **Test Continuously**: Write tests alongside implementation code
3. **Document Decisions**: Record important architectural decisions
4. **Handle Errors**: Implement proper error handling and logging
5. **Update Progress**: Mark checklist items as completed

### Completing Work
1. **Verify Requirements**: Ensure all acceptance criteria are met
2. **Run Tests**: Execute full test suite and fix any failures
3. **Update Documentation**: Update relevant documentation
4. **Mark Complete**: Update checklist to reflect task completion
5. **Plan Next Steps**: Identify and prepare for next task

## Quality Assurance

### Self-Review Checklist
Before marking any task complete, verify:
- [ ] All acceptance criteria are met
- [ ] Code follows established patterns and conventions
- [ ] Tests are written and passing
- [ ] Error handling is comprehensive
- [ ] Documentation is updated
- [ ] Security considerations are addressed
- [ ] Performance requirements are met

### Testing Requirements
- **Unit Tests**: Test all business logic components with 90%+ coverage
- **Integration Tests**: Test component interactions and external integrations
- **Security Tests**: Verify authentication, authorization, and data protection
- **Performance Tests**: Ensure latency and throughput requirements are met
- **Cross-Browser Tests**: Verify compatibility across target browsers

### Documentation Standards
- **Code Comments**: Add meaningful comments for complex logic
- **API Documentation**: Document all public interfaces with examples
- **Architecture Decisions**: Record important design decisions and rationale
- **Setup Instructions**: Provide clear setup and configuration guides
- **Troubleshooting**: Document common issues and solutions

## Specialized Instructions

### For Backend/Server Development
- **Security First**: Implement comprehensive security measures from the start
- **Scalability**: Design for concurrent users and future growth
- **Error Handling**: Implement graceful error handling and recovery
- **Logging**: Add comprehensive logging for debugging and monitoring
- **Performance**: Optimize for low latency and high throughput

### For Frontend/Web Client Development
- **Responsive Design**: Ensure optimal experience on all device sizes
- **Accessibility**: Follow WCAG guidelines for accessibility
- **Performance**: Optimize for fast loading and smooth interactions
- **User Experience**: Create intuitive, user-friendly interfaces
- **Cross-Browser**: Test and ensure compatibility across target browsers

### For Security Implementation
- **Authentication**: Implement secure JWT-based authentication
- **Authorization**: Create granular role-based access control
- **Data Protection**: Encrypt all sensitive data in transit and at rest
- **Audit Logging**: Log all security-relevant events
- **Vulnerability Prevention**: Follow secure coding practices to prevent common vulnerabilities

### For Integration with Cline Extension
- **Backward Compatibility**: Ensure no breaking changes to existing functionality
- **Message Protocol**: Maintain compatibility with existing Cline message formats
- **Lifecycle Management**: Properly integrate with VS Code extension lifecycle
- **Resource Management**: Avoid performance impact on VS Code extension
- **Configuration**: Integrate with existing Cline settings and configuration

## Blocker Handling

### Identifying Blockers
- **Missing Information**: Requirements are unclear or incomplete
- **Technical Constraints**: Existing limitations prevent implementation
- **Dependency Issues**: Required components or services are not available
- **Integration Problems**: Difficulty integrating with existing systems
- **Performance Issues**: Implementation does not meet performance requirements

### Resolving Blockers
1. **Document Blocker**: Clearly describe the issue and its impact
2. **Research Solutions**: Investigate potential workarounds and alternatives
3. **Consult Documentation**: Review existing Cline documentation and patterns
4. **Seek Collaboration**: Discuss with other agents or project lead
5. **Propose Solution**: Document recommended approach for resolution

### Escalation Protocol
1. **Attempt Resolution**: Try to resolve blocker independently first
2. **Document Attempts**: Record all attempted solutions and their results
3. **Request Assistance**: Escalate to project lead with complete documentation
4. **Accept Decision**: Implement agreed-upon solution approach
5. **Document Resolution**: Record final resolution for future reference

## Development Environment

### Tools and Setup
- **Node.js**: Use version specified in Cline's package.json
- **TypeScript**: Follow Cline's tsconfig.json configuration
- **Testing**: Use Vitest for unit tests, Playwright for E2E tests
- **Linting**: Use Biome with Cline's configuration
- **Build Tools**: Use Vite for frontend, esbuild for backend

### Debugging Guidelines
- **Console Logging**: Use structured logging with appropriate log levels
- **Error Tracking**: Implement comprehensive error tracking and reporting
- **Performance Monitoring**: Add performance metrics and monitoring
- **Debug Mode**: Create debug modes for detailed troubleshooting
- **Test Coverage**: Use test coverage to identify untested code paths

### Development Workflow
- **Feature Branches**: Create separate branches for each major feature
- **Commit Standards**: Follow Cline's commit message conventions
- **Code Reviews**: Ensure all changes are reviewed before merging
- **Testing Pipeline**: Run full test suite before merging changes
- **Documentation Updates**: Update documentation with each change

## Collaboration Guidelines

### Working with Other Agents
- **Communication**: Clearly communicate progress, blockers, and decisions
- **Coordination**: Coordinate work to avoid conflicts and duplication
- **Knowledge Sharing**: Share insights and learnings with the team
- **Quality Standards**: Maintain consistent quality across all work
- **Support**: Provide assistance to other agents when needed

### Handoff Procedures
- **Status Updates**: Provide comprehensive status updates when handing off work
- **Documentation**: Ensure all work is properly documented
- **Testing**: Verify all tests are passing before handoff
- **Known Issues**: Document any known issues or limitations
- **Next Steps**: Provide clear guidance for next steps

### Conflict Resolution
- **Technical Disagreements**: Discuss technical approaches and reach consensus
- **Priority Conflicts**: Escalate priority conflicts to project lead
- **Resource Competition**: Coordinate resource usage to avoid conflicts
- **Quality Standards**: Maintain consistent quality standards across all work
- **Documentation**: Document conflict resolutions for future reference

---

## Success Metrics

Your success will be measured by:
- **Task Completion**: Percentage of checklist items completed on schedule
- **Quality Standards**: Code quality metrics, test coverage, and security compliance
- **Performance**: Meeting performance requirements and benchmarks
- **User Satisfaction**: Feedback from beta testing and user acceptance
- **Collaboration**: Effectiveness of coordination with other agents

## Continuous Improvement

### Learning and Adaptation
- **Retrospectives**: Regularly review and improve development processes
- **Pattern Recognition**: Identify and apply successful patterns
- **Knowledge Capture**: Document learnings and best practices
- **Tool Improvement**: Suggest improvements to tools and processes
- **Skill Development**: Continuously develop technical and collaboration skills

### Feedback Integration
- **User Feedback**: Incorporate feedback from testing and user acceptance
- **Technical Reviews**: Learn from code reviews and technical discussions
- **Performance Analysis**: Use performance metrics to identify improvements
- **Security Reviews**: Incorporate findings from security audits and reviews
- **Process Refinement**: Continuously improve development processes

---

*These instructions provide the foundation for successful autonomous AI development of the Cline Remote Access System. Follow these guidelines to work efficiently, maintain high quality standards, and collaborate effectively with other agents.*
