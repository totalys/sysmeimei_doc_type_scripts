//------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------------------------------------------------------------------------------------------//
//---------------------- Nome: LM PreCad Options.js
//------------------- Doctype: LM PreCad
//----------------- Descricao: Processamento da Guia Opções de Cursos
//------------------ Contexto: Cadastro inicial dos usuários do Lar Meimei
//---------------------- Data: 12/08/2024
//--------------------- Autor: Eduardo Kuniyoshi (EK)
//--- Histórico de alterações:
//----------------------------  1.0 - EK - 12/08/2024 - Liberação  da versão para o processo de inscrição 2o. Sem/2024
//----------------------------  2.0 - EK - 21/09/2024 - Tratamento das opções 1o. Sem/2025
//----------------------------  3.0 - EK - 22/05/2025 - Tratamento das opções 2o. Sem/2025
//----------------------------  4.0 - Refactoring - Melhorias na organização e legibilidade
//----------------------------  5.0 - Unificação - Sistema integrado com logging, validação e tratamento de erros
//------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------------------------------------------------------------------------------------------//

/**
 * Constantes e configurações
 */
const COURSE_CODES = {
    INFORMATICA: "220",
    DIGITACAO: "255"
};

const DEPARTMENTS = {
    INFORMATICA: "220 - Informática Básica - LM",
    DIGITACAO: "255 - Digitação - LM"
};

const SEGMENTS = {
    MUNDO_TRABALHO: "MT - Mundo do Trabalho",
    SOCIO_FAMILIAR: "SF - Sócio Familiar"
};

const STATUS = {
    PRE_CADASTRO: "O.Inicial",
    MATRICULADO: "5.Matriculado",
    ENTREVISTA: "4.Entrevista",
    CADASTRO_CONFERIDO: "1.Pré Cadastro",
    EM_INSCRICAO: "Em inscrição"
};

/**
 * Sistema de logging para auditoria e debugging
 */
const Logger = {
    LEVELS: { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO', DEBUG: 'DEBUG' },
    currentLevel: 'INFO',

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp, level, message, data,
            user: frappe.session.user || 'unknown',
            doctype: 'LM PreCad'
        };

        if (this.shouldLog(level)) {
            console.log(`[${timestamp}] ${level}: ${message}`, data || '');
        }

        if (level === this.LEVELS.ERROR || level === this.LEVELS.WARN) {
            this.saveToBackend(logEntry);
        }
    },

    shouldLog(level) {
        const levels = Object.values(this.LEVELS);
        const currentIndex = levels.indexOf(this.currentLevel);
        const messageIndex = levels.indexOf(level);
        return messageIndex <= currentIndex;
    },

    async saveToBackend(logEntry) {
        try {
            await frappe.call({
                method: "save_audit_log",
                args: { log_entry: logEntry },
                async: true
            });
        } catch (error) {
            console.error('Erro ao salvar log:', error);
        }
    },

    error(message, data) { this.log(this.LEVELS.ERROR, message, data); },
    warn(message, data) { this.log(this.LEVELS.WARN, message, data); },
    info(message, data) { this.log(this.LEVELS.INFO, message, data); },
    debug(message, data) { this.log(this.LEVELS.DEBUG, message, data); }
};

/**
 * Utilitário para tratamento de erros
 */
const ErrorHandler = {
    handleAPIError(error, operation) {
        Logger.error(`Erro durante ${operation}`, { error: error.message, stack: error.stack });
        
        frappe.msgprint({
            title: 'Erro',
            message: `Erro durante ${operation}. Por favor, tente novamente.`,
            indicator: 'red'
        });
    },

    async safeExecute(operation, operationName) {
        try {
            return await operation();
        } catch (error) {
            this.handleAPIError(error, operationName);
            throw error;
        }
    }
};

/**
 * Sistema de validação aprimorado
 */
const EnhancedValidator = {
    validateBasicForm(frm) {
        const errors = [];

        if (!frm.doc.date_of_birth) {
            errors.push('Data de nascimento é obrigatória');
        }

        if (!frm.doc.first_name || frm.doc.first_name.trim().length < 2) {
            errors.push('Nome deve ter pelo menos 2 caracteres');
        }

        if (frm.doc.cpf && !this.isValidCPF(frm.doc.cpf)) {
            errors.push('CPF inválido');
        }

        return { isValid: errors.length === 0, errors };
    },

    isValidCPF(cpf) {
        cpf = cpf.replace(/[^\d]/g, '');
        
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
            return false;
        }

        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        
        let remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        
        return remainder === parseInt(cpf.charAt(10));
    },

    validateScheduleConflicts(frm) {
        const conflicts = [];
        const selectedCourses = [];
        const courseFields = [
            'student_group_sab', 'student_group_sab_2', 'student_group_sab_t',
            'student_group_dom', 'student_group_dom_2'
        ];

        courseFields.forEach(field => {
            if (frm.doc[field]) {
                selectedCourses.push({
                    field: field,
                    course: frm.doc[field],
                    day: field.includes('sab') ? 'Sábado' : 'Domingo',
                    period: field.includes('_t') ? 'Tarde' : 'Manhã'
                });
            }
        });

        const schedule = {};
        selectedCourses.forEach(course => {
            const key = `${course.day}_${course.period}`;
            if (schedule[key]) {
                conflicts.push(`Conflito de horário: ${course.day} ${course.period}`);
            }
            schedule[key] = course;
        });

        return { hasConflicts: conflicts.length > 0, conflicts, selectedCourses };
    },

    performFullValidation(frm) {
        const validationResults = {
            basicForm: this.validateBasicForm(frm),
            scheduleConflicts: this.validateScheduleConflicts(frm),
            courseSelection: CourseSelectionValidator.hasAnySelection(frm),
            errors: [],
            warnings: []
        };

        if (!validationResults.basicForm.isValid) {
            validationResults.errors.push(...validationResults.basicForm.errors);
        }

        if (validationResults.scheduleConflicts.hasConflicts) {
            validationResults.errors.push(...validationResults.scheduleConflicts.conflicts);
        }

        if (!validationResults.courseSelection) {
            validationResults.errors.push('Nenhuma opção de curso foi selecionada');
        }

        return validationResults;
    },

    displayValidationResults(results) {
        if (results.errors.length > 0) {
            frappe.msgprint({
                title: 'Erros de Validação',
                message: results.errors.join('<br>'),
                indicator: 'red'
            });
            return false;
        }

        if (results.warnings.length > 0) {
            frappe.msgprint({
                title: 'Avisos',
                message: results.warnings.join('<br>'),
                indicator: 'yellow'
            });
        }

        return true;
    }
};

/**
 * Auditoria de ações do usuário
 */
const AuditTrail = {
    logUserAction(action, details, formData) {
        Logger.info(`Ação do usuário: ${action}`, {
            action, details,
            studentName: formData.first_name,
            studentId: formData.name,
            courseSelections: this.extractCourseSelections(formData)
        });
    },

    extractCourseSelections(formData) {
        const selections = {};
        const courseFields = [
            'student_group_sab', 'student_group_sab_2', 'student_group_sab_t',
            'student_group_dom', 'student_group_dom_2'
        ];

        courseFields.forEach(field => {
            if (formData[field]) {
                selections[field] = formData[field];
            }
        });

        return selections;
    },

    logStatusChange(oldStatus, newStatus, formData) {
        Logger.info('Mudança de status', {
            action: 'status_change', oldStatus, newStatus,
            studentName: formData.first_name,
            studentId: formData.name,
            timestamp: new Date().toISOString()
        });
    },

    logAPIOperation(operation, success, details) {
        if (success) {
            Logger.info(`API ${operation} - Sucesso`, details);
        } else {
            Logger.error(`API ${operation} - Falha`, details);
        }
    }
};

/**
 * Utilitários para validação de idade - Versão melhorada
 */
const AgeValidator = {
    validate(frm, studentGroup, startDate, minAge, maxAge) {
        if (!startDate || !studentGroup) return false;

        frm.doc.application_date = frappe.datetime.get_today();
        frm.doc.senai_dt_assinatura = frappe.datetime.get_today();

        const totalAge = Math.floor(
            moment(startDate).diff(frm.doc.date_of_birth, 'days', true) / 365
        );

        frm.doc.idade = totalAge;

        if (totalAge < minAge) {
            this.showAgeError(totalAge, minAge, maxAge, 'menor');
            Logger.warn('Idade insuficiente para curso', {
                studentAge: totalAge, minAge, maxAge,
                course: studentGroup
            });
            return false;
        }

        if (maxAge > 0 && totalAge > maxAge) {
            this.showAgeError(totalAge, minAge, maxAge, 'maior');
            Logger.warn('Idade excede limite para curso', {
                studentAge: totalAge, minAge, maxAge,
                course: studentGroup
            });
            return false;
        }

        Logger.debug('Idade validada com sucesso', {
            studentAge: totalAge, minAge, maxAge, course: studentGroup
        });

        return true;
    },

    showAgeError(currentAge, minAge, maxAge, type) {
        frappe.msgprint([
            `Validação da Idade do usuário(a): ${currentAge}`,
            `Idade mínima: ${minAge} | Idade máxima: ${maxAge}`,
            `*** ATENÇÃO! Idade do usuário(a) ${type} que a idade ${type === 'menor' ? 'mínima' : 'MÁXIMA'} para o curso.`
        ].join('<br>'));
    }
};

/**
 * Gerenciador de consultas de cursos
 */
const CourseQueryManager = {
    getBaseFilters(day) {
        return {
            "Dia": day,
            "status": STATUS.EM_INSCRICAO
        };
    },

    setupSaturdayQuery(frm) {
        frm.set_query("student_group_sab", () => ({
            filters: this.getBaseFilters('Sab')
        }));

        frm.set_query("student_group_sab_t", () => ({
            filters: this.getBaseFilters('Sab')
        }));

        frm.set_query("student_group_sab_2", () => ({
            filters: {
                ...this.getBaseFilters('Sab'),
                "student_group_name": ["not in", [frm.doc.student_group_sab, frm.doc.student_group_sab_t]]
            }
        }));
    },

    setupSundayQuery(frm) {
        frm.set_query("student_group_dom", () => ({
            filters: this.getBaseFilters('Dom')
        }));

        frm.set_query("student_group_dom_2", () => ({
            filters: {
                ...this.getBaseFilters('Dom'),
                "student_group_name": ["not in", [frm.doc.student_group_dom]]
            }
        }));
    },

    applyInformaticaFilters(frm, excludeInformatica = true) {
        const departmentFilter = excludeInformatica 
            ? ["!=", DEPARTMENTS.INFORMATICA]
            : DEPARTMENTS.INFORMATICA;

        frm.set_query("student_group_dom", () => ({
            filters: {
                ...this.getBaseFilters('Dom'),
                "Department": departmentFilter
            }
        }));

        frm.set_query("student_group_dom_2", () => ({
            filters: {
                ...this.getBaseFilters('Dom'),
                "Department": departmentFilter,
                "student_group_name": ["not in", [frm.doc.student_group_dom]]
            }
        }));
    }
};

/**
 * Gerenciador de segmentos de curso
 */
const SegmentManager = {
    update(frm) {
        const hasAnySelection = this.hasAnyCourseSelection(frm);
        
        if (!hasAnySelection) {
            this.clearSegments(frm);
            return;
        }

        this.updateSegmentFlags(frm);
    },

    hasAnyCourseSelection(frm) {
        return !!(frm.doc.student_group_dom || frm.doc.student_group_dom_2 ||
                 frm.doc.student_group_sab || frm.doc.student_group_sab_2 ||
                 frm.doc.student_group_sab_t);
    },

    clearSegments(frm) {
        frm.doc.mundo_trabalho = 0;
        frm.doc.socio_familiar = 0;
    },

    updateSegmentFlags(frm) {
        const segments = this.getSelectedSegments(frm);
        
        frm.doc.mundo_trabalho = segments.includes(SEGMENTS.MUNDO_TRABALHO) ? 1 : 0;
        frm.doc.socio_familiar = segments.includes(SEGMENTS.SOCIO_FAMILIAR) ? 1 : 0;
    },

    getSelectedSegments(frm) {
        const segments = [];
        const courseFields = [
            { segment: 'segmento_dom', ageOk: 'idade_aluno_dom_ok' },
            { segment: 'segmento_dom_2', ageOk: 'idade_aluno_dom_2_ok' },
            { segment: 'segmento_sab', ageOk: 'idade_aluno_sab_ok' },
            { segment: 'segmento_sab_2', ageOk: 'idade_aluno_sab_2_ok' },
            { segment: 'segmento_sab_t', ageOk: 'idade_aluno_sab_t_ok' }
        ];

        courseFields.forEach(field => {
            if (frm.doc[field.segment] && frm.doc[field.ageOk]) {
                segments.push(frm.doc[field.segment]);
            }
        });

        return segments;
    }
};

/**
 * Configurações para cada tipo de curso
 */
const COURSE_CONFIGS = {
    SAB: {
        studentGroupField: 'student_group_sab',
        startDateField: 'dt_inicio_sab',
        minAgeField: 'idade_minima_sab',
        maxAgeField: 'idade_maxima_sab',
        ageOkField: 'idade_aluno_sab_ok',
        interviewField: 'sab_interview',
        deleteProcess: 'del_sab',
        allowDigitacaoFilters: true
    },
    SAB_2: {
        studentGroupField: 'student_group_sab_2',
        startDateField: 'dt_inicio_sab_2',
        minAgeField: 'idade_minima_sab_2',
        maxAgeField: 'idade_maxima_sab_2',
        ageOkField: 'idade_aluno_sab_2_ok',
        interviewField: 'sab_2_interview',
        deleteProcess: 'del_sab_2',
        requiresPrimarySelection: ['student_group_sab', 'student_group_sab_t']
    },
    SAB_T: {
        studentGroupField: 'student_group_sab_t',
        startDateField: 'dt_inicio_sab_t',
        minAgeField: 'idade_minima_sab_t',
        maxAgeField: 'idade_maxima_sab_t',
        ageOkField: 'idade_aluno_sab_t_ok',
        interviewField: 'sab_t_interview',
        deleteProcess: 'del_sab_t'
    },
    DOM: {
        studentGroupField: 'student_group_dom',
        startDateField: 'dt_inicio_dom',
        minAgeField: 'idade_minima_dom',
        maxAgeField: 'idade_maxima_dom',
        ageOkField: 'idade_aluno_dom_ok',
        interviewField: 'dom_interview',
        deleteProcess: 'del_dom'
    },
    DOM_2: {
        studentGroupField: 'student_group_dom_2',
        startDateField: 'dt_inicio_dom_2',
        minAgeField: 'idade_minima_dom_2',
        maxAgeField: 'idade_maxima_dom_2',
        ageOkField: 'idade_aluno_dom_2_ok',
        interviewField: 'dom_2_interview',
        deleteProcess: 'del_dom_2',
        requiresPrimarySelection: ['student_group_dom']
    }
};

/**
 * Handler genérico para seleção de cursos
 */
const CourseSelectionHandler = {
    handleCourseSelection(frm, config) {
        if (!frm.doc[config.studentGroupField]) return;

        Logger.debug(`Seleção de curso iniciada: ${config.studentGroupField}`, {
            selectedCourse: frm.doc[config.studentGroupField],
            studentName: frm.doc.first_name
        });

        // Verificar se requer seleção primária
        if (config.requiresPrimarySelection) {
            const hasPrimarySelection = config.requiresPrimarySelection.some(field => frm.doc[field]);
            if (!hasPrimarySelection) {
                const message = config.studentGroupField.includes('sab_2') 
                    ? '*** ATENÇÃO! Não foram escolhidas as opções para o sábado (manhã ou tarde)!'
                    : '*** ATENÇÃO! Não foi escolhida a opção principal!';
                
                frappe.msgprint(message);
                this.handleDeleteOption(frm, config);
                return;
            }
        }

        const isValidAge = AgeValidator.validate(
            frm, 
            frm.doc[config.studentGroupField], 
            frm.doc[config.startDateField],
            frm.doc[config.minAgeField], 
            frm.doc[config.maxAgeField]
        );

        if (isValidAge) {
            frm.set_value(config.ageOkField, 1);
            this.applyFiltersBasedOnCourse(frm, config);
            
            AuditTrail.logUserAction('course_selection', {
                course: frm.doc[config.studentGroupField],
                ageValidated: true,
                config: config.studentGroupField
            }, frm.doc);
        } else {
            this.handleInvalidAge(frm, config);
        }

        SegmentManager.update(frm);
        frm.refresh();
    },

    applyFiltersBasedOnCourse(frm, config) {
        const courseCode = frm.doc[config.studentGroupField].substring(0, 3);
        
        if (courseCode === COURSE_CODES.INFORMATICA) {
            CourseQueryManager.applyInformaticaFilters(frm, true);
        } else if (courseCode === COURSE_CODES.DIGITACAO && config.allowDigitacaoFilters) {
            CourseQueryManager.applyInformaticaFilters(frm, false);
        }
    },

    handleInvalidAge(frm, config) {
        if (frm.doc[config.interviewField]) {
            frm.doc.processamento = config.deleteProcess;
            APIManager.deleteInterview(frm);
        } else {
            OptionCleaner.clearOptionByConfig(frm, config);
        }
    },

    handleDeleteOption(frm, config) {
        Logger.info(`Apagando opção de curso: ${config.studentGroupField}`, {
            course: frm.doc[config.studentGroupField],
            studentName: frm.doc.first_name
        });

        if (frm.doc[config.interviewField]) {
            frm.doc.processamento = config.deleteProcess;
            APIManager.deleteInterview(frm);
        } else {
            OptionCleaner.clearOptionByConfig(frm, config);
        }
        
        AuditTrail.logUserAction('course_deletion', {
            course: frm.doc[config.studentGroupField],
            config: config.studentGroupField
        }, frm.doc);
        
        SegmentManager.update(frm);
        frm.refresh();
    }
};

/**
 * Gerenciador de limpeza de opções - Versão melhorada
 */
const OptionCleaner = {
    clearOptionByConfig(frm, config) {
        frm.set_value(config.ageOkField, 0);
        frm.set_value(config.studentGroupField, "");
        this.clearCourseDataByConfig(frm, config);
        this.restoreInformaticaFilters(frm);
    },

    clearCourseDataByConfig(frm, config) {
        const suffix = config.studentGroupField.replace('student_group_', '');
        
        const fields = [
            `idade_minima_${suffix}`, `idade_maxima_${suffix}`, `escolaridade_${suffix}`,
            `program_${suffix}`, `academic_year_${suffix}`, `academic_term_${suffix}`,
            `segmento_${suffix}`, `${suffix}_interview`
        ];

        fields.forEach(field => {
            if (frm.doc.hasOwnProperty(field)) {
                frm.doc[field] = "";
            }
        });

        frm.doc.status = STATUS.PRE_CADASTRO;
        frm.doc.sit_op_curso = 0;

        if (suffix.includes('sab')) {
            frm.doc[`senai_${suffix}`] = 0;
        }

        if (suffix === 'dom') {
            frm.doc.senai_dom = 0;
        }
    },

    restoreInformaticaFilters(frm) {
        CourseQueryManager.setupSundayQuery(frm);
        CourseQueryManager.setupSaturdayQuery(frm);
    },

    // Métodos de compatibilidade com código original
    clearSaturdayOption(frm) { this.clearOptionByConfig(frm, COURSE_CONFIGS.SAB); },
    clearSaturday2Option(frm) { this.clearOptionByConfig(frm, COURSE_CONFIGS.SAB_2); },
    clearSaturdayAfternoonOption(frm) { this.clearOptionByConfig(frm, COURSE_CONFIGS.SAB_T); },
    clearSundayOption(frm) { this.clearOptionByConfig(frm, COURSE_CONFIGS.DOM); },
    clearSunday2Option(frm) { this.clearOptionByConfig(frm, COURSE_CONFIGS.DOM_2); }
};

/**
 * Gerenciador de chamadas para API - Versão melhorada
 */
const APIManager = {
    async callWithLogging(method, args, operationName) {
        const startTime = Date.now();
        
        Logger.info(`Iniciando ${operationName}`, { 
            method, 
            args: { ...args, doc: '[omitido para privacidade]' } 
        });

        try {
            const result = await frappe.call({
                method,
                args,
                async: false,
                callback: (response) => {
                    if (response.message) {
                        frappe.msgprint({
                            title: operationName,
                            message: response.message,
                            indicator: 'green'
                        });
                    }
                }
            });

            const duration = Date.now() - startTime;
            
            AuditTrail.logAPIOperation(operationName, true, {
                method, duration: `${duration}ms`, response: result.message
            });

            Logger.info(`${operationName} concluído com sucesso`, { duration: `${duration}ms` });
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            AuditTrail.logAPIOperation(operationName, false, {
                method, duration: `${duration}ms`, error: error.message
            });

            Logger.error(`Erro em ${operationName}`, { 
                error: error.message, 
                stack: error.stack,
                duration: `${duration}ms`
            });
            
            throw error;
        }
    },

    async insertStudent(frm) {
        return this.callWithLogging("InsertStudent", { doc: frm.doc }, "Inserção de Estudante");
    },

    async insertEnrollment(frm) {
        return this.callWithLogging("InsertEnrollment", { doc: frm.doc }, "Inserção de Matrícula");
    },

    async insertInterview(frm) {
        return this.callWithLogging("InsertEntrevista", { doc: frm.doc }, "Inserção de Entrevista");
    },

    async deleteInterview(frm) {
        return this.callWithLogging("DeleteEntrevista", { doc: frm.doc }, "Exclusão de Entrevista");
    },

    async performEnrollment(frm) {
        try {
            frm.set_value('processing', true);
            
            await this.insertStudent(frm);
            await frm.save();
            await this.insertEnrollment(frm);
            
            frm.set_value('status', STATUS.MATRICULADO);
            frm.set_value('processing', false);
            
            frappe.show_alert({
                message: 'Matrícula realizada com sucesso!',
                indicator: 'green'
            }, 5);
            
        } catch (error) {
            frm.set_value('processing', false);
            frm.set_value('status', STATUS.PRE_CADASTRO);
            Logger.error('Erro durante matrícula', { error: error.message });
            throw error;
        } finally {
            frm.refresh();
        }
    }
};

/**
 * Validador de seleções de curso
 */
const CourseSelectionValidator = {
    hasAnySelection(frm) {
        return !!(frm.doc.student_group_sab || frm.doc.student_group_sab_t || 
                 frm.doc.student_group_sab_2 || frm.doc.student_group_dom || 
                 frm.doc.student_group_dom_2);
    },

    showNoSelectionAlert() {
        frappe.msgprint('*** ATENÇÃO! Nenhuma opção de curso foi selecionada.');
    }
};

/**
 * Event Handlers principais
 */

// Configuração inicial do formulário
frappe.ui.form.on("LM PreCad", "onload", function(frm) {
    Logger.info('Formulário carregado', { studentName: frm.doc.first_name });
    CourseQueryManager.setupSaturdayQuery(frm);
    CourseQueryManager.setupSundayQuery(frm);
});

// Botão Matricular - Versão melhorada
frappe.ui.form.on('LM PreCad', 'btn_matricular', async function(frm) {
    const oldStatus = frm.doc.status;
    
    Logger.info('Processo de matrícula iniciado', {
        studentName: frm.doc.first_name,
        currentStatus: oldStatus
    });

    // Validação completa
    const validationResults = EnhancedValidator.performFullValidation(frm);
    
    if (!EnhancedValidator.displayValidationResults(validationResults)) {
        Logger.warn('Matrícula cancelada devido a erros de validação', {
            errors: validationResults.errors
        });
        return;
    }

    // Confirmar ação
    const confirmed = await new Promise(resolve => {
        frappe.confirm(
            'Tem certeza que deseja realizar a matrícula do estudante?',
            () => resolve(true),
            () => resolve(false)
        );
    });

    if (!confirmed) {
        Logger.info('Matrícula cancelada pelo usuário');
        return;
    }

    frappe.dom.freeze('Processando matrícula...');

    try {
        if (!frm.is_dirty()) {
            console.log("btn_matricular: not dirty");
            frm.dirty();
        }

        await APIManager.performEnrollment(frm);
        
        AuditTrail.logStatusChange(oldStatus, STATUS.MATRICULADO, frm.doc);
        AuditTrail.logUserAction('enrollment_completed', {
            success: true,
            finalStatus: STATUS.MATRICULADO
        }, frm.doc);
        
        Logger.info('Matrícula concluída com sucesso', {
            studentName: frm.doc.first_name,
            newStatus: STATUS.MATRICULADO
        });
        
    } catch (error) {
        Logger.error('Falha no processo de matrícula', {
            studentName: frm.doc.first_name,
            error: error.message,
            currentStatus: frm.doc.status
        });
        
        AuditTrail.logUserAction('enrollment_failed', {
            error: error.message,
            status: frm.doc.status
        }, frm.doc);
    } finally {
        frappe.dom.unfreeze();
    }
});

// Botão Inserir Entrevista - Versão melhorada
frappe.ui.form.on('LM PreCad', 'btn_insert_interview', async function(frm) {
    if (!CourseSelectionValidator.hasAnySelection(frm)) {
        CourseSelectionValidator.showNoSelectionAlert();
        frm.set_value('entrevista', 0);
        return;
    }

    Logger.info('Inserção de entrevista iniciada', {
        studentName: frm.doc.first_name
    });

    try {
        if (!frm.is_dirty()) {
            console.log("btn_insert_interview: not dirty");
            frm.dirty();
        }

        await frm.save();
        await APIManager.insertInterview(frm);
        
        frm.set_value('status', STATUS.ENTREVISTA);
        frm.set_value('entrevista', 1);
        
        AuditTrail.logUserAction('interview_scheduled', {
            success: true,
            status: STATUS.ENTREVISTA
        }, frm.doc);
        
        frm.refresh();
        
    } catch (error) {
        Logger.error('Erro na inserção de entrevista', {
            studentName: frm.doc.first_name,
            error: error.message
        });
    }
});

// Handlers para seleção de cursos - Versão unificada
frappe.ui.form.on('LM PreCad', 'student_group_sab', function(frm) {
    CourseSelectionHandler.handleCourseSelection(frm, COURSE_CONFIGS.SAB);
});

frappe.ui.form.on('LM PreCad', 'apaga_opcao_sab', function(frm) {
    CourseSelectionHandler.handleDeleteOption(frm, COURSE_CONFIGS.SAB);
});

frappe.ui.form.on('LM PreCad', 'student_group_sab_2', function(frm) {
    CourseSelectionHandler.handleCourseSelection(frm, COURSE_CONFIGS.SAB_2);
});

frappe.ui.form.on('LM PreCad', 'apaga_opcao_sab_2', function(frm) {
    CourseSelectionHandler.handleDeleteOption(frm, COURSE_CONFIGS.SAB_2);
});

frappe.ui.form.on('LM PreCad', 'student_group_sab_t', function(frm) {
    CourseSelectionHandler.handleCourseSelection(frm, COURSE_CONFIGS.SAB_T);
});

frappe.ui.form.on('LM PreCad', 'apaga_opcao_sab_t', function(frm) {
    CourseSelectionHandler.handleDeleteOption(frm, COURSE_CONFIGS.SAB_T);
});

frappe.ui.form.on('LM PreCad', 'student_group_dom', function(frm) {
    CourseSelectionHandler.handleCourseSelection(frm, COURSE_CONFIGS.DOM);
});

frappe.ui.form.on('LM PreCad', 'apaga_opcao_dom', function(frm) {
    try {
        CourseSelectionHandler.handleDeleteOption(frm, COURSE_CONFIGS.DOM);
    } catch (error) {
        Logger.error('Erro em apaga_opcao_dom', { error: error.message });
    }
});

frappe.ui.form.on('LM PreCad', 'student_group_dom_2', function(frm) {
    CourseSelectionHandler.handleCourseSelection(frm, COURSE_CONFIGS.DOM_2);
});

frappe.ui.form.on('LM PreCad', 'apaga_opcao_dom_2', function(frm) {
    CourseSelectionHandler.handleDeleteOption(frm, COURSE_CONFIGS.DOM_2);
});

/**
 * Função auxiliar para criar cliente (mantida para compatibilidade)
 */
function create_customer(frm) {
    Logger.info('Criação de cliente iniciada', {
        exists: frm.doc.ifexist,
        studentName: frm.doc.first_name
    });

    if (frm.doc.ifexist) {
        frappe.show_alert('Usuário já existente no Cadastro Lar Meimei.', 5);
        Logger.info('Cliente já existe', { studentName: frm.doc.first_name });
    } else {
        frm.doc.processamento = 'LM PreCadastro';
        
        frappe.call({
            method: "InsertCustomer",
            args: { doc: frm.doc },
            async: false
        });
        
        frappe.show_alert('Usuário INSERIDO no Cadastro Lar Meimei.', 5);
        Logger.info('Cliente criado com sucesso', { studentName: frm.doc.first_name });
        
        AuditTrail.logUserAction('customer_created', {
            success: true
        }, frm.doc);
    }
}