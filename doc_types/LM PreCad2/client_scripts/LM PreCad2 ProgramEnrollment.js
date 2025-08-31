/**
 * ===== PROCESSADOR INDEPENDENTE DE PROGRAM ENROLLMENT =====
 * Versão: 1.0 - Criação automática de Program Enrollment
 * Data: 2025-07-24
 * 
 * Função: Criar Program Enrollment automaticamente após criação de Gestante Ficha
 * Uso: LMProgramEnrollmentProcessor.criar(studentId, studentGroupId, gestanteData)
 */
window.LMProgramEnrollmentProcessor = (function() {
    'use strict';
    
    // ===== CONFIGURAÇÕES =====
    var CONFIG = {
        version: '1.0-PROGRAM-ENROLLMENT',
        debug: true,
        defaultProgram: 'Gestantes', // Nome padrão do programa
        timeouts: {
            create: 15000,
            search: 10000
        },
        
        getCurrentAcademicYear: function() {
            Utils.log('📅 Buscando Academic Year atual');
            
            return new Promise(function(resolve, reject) {
                // Primeiro tentar buscar Academic Year ativo
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Academic Year',
                        fields: ['name', 'year_start_date', 'year_end_date', 'disabled'],
                        filters: {
                            'disabled': 0
                        },
                        order_by: 'year_start_date desc',
                        limit: 1
                    },
                    callback: function(response) {
                        if (response && response.message && response.message.length > 0) {
                            Utils.log('✅ Academic Year ativo encontrado: ' + response.message[0].name);
                            resolve(response.message[0]);
                        } else {
                            Utils.log('⚠️ Nenhum Academic Year ativo, buscando qualquer um...');
                            
                            // Buscar qualquer Academic Year disponível
                            frappe.call({
                                method: 'frappe.client.get_list',
                                args: {
                                    doctype: 'Academic Year',
                                    fields: ['name', 'year_start_date', 'year_end_date'],
                                    order_by: 'year_start_date desc',
                                    limit: 1
                                },
                                callback: function(anyResponse) {
                                    if (anyResponse && anyResponse.message && anyResponse.message.length > 0) {
                                        Utils.log('✅ Academic Year encontrado: ' + anyResponse.message[0].name);
                                        resolve(anyResponse.message[0]);
                                    } else {
                                        Utils.error('❌ Nenhum Academic Year encontrado no sistema');
                                        reject(new Error('Nenhum Academic Year encontrado. Cadastre um Academic Year no sistema.'));
                                    }
                                },
                                error: function(error) {
                                    Utils.error('Erro ao buscar Academic Years:', error);
                                    reject(error);
                                }
                            });
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Academic Year ativo:', error);
                        reject(error);
                    }
                });
            });
        },
        
        listAvailablePrograms: function() {
            Utils.log('📋 Listando Programs disponíveis');
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Program',
                        fields: ['name', 'program_name', 'program_abbreviation'],
                        limit: 20
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Programs encontrados: ' + response.message.length);
                            resolve(response.message);
                        } else {
                            resolve([]);
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao listar Programs:', error);
                        resolve([]);
                    }
                });
            });
        },
        retries: {
            max: 3,
            delay: 1000
        }
    };
    
    // ===== UTILITÁRIOS =====
    var Utils = {
        log: function(message, data) {
            if (CONFIG.debug) {
                console.log('[LMProgramEnrollment] ' + message, data || '');
            }
        },
        
        error: function(message, error) {
            console.error('[LMProgramEnrollment] ❌ ' + message, error);
        },
        
        sleep: function(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        },
        
        retry: function(operation, maxRetries) {
            maxRetries = maxRetries || CONFIG.retries.max;
            var self = this;
            
            function attemptOperation(attempt) {
                return operation().catch(function(error) {
                    Utils.error('Tentativa ' + (attempt + 1) + '/' + maxRetries + ' falhou:', error);
                    if (attempt === maxRetries - 1) {
                        throw error;
                    }
                    return self.sleep(CONFIG.retries.delay * (attempt + 1)).then(function() {
                        return attemptOperation(attempt + 1);
                    });
                });
            }
            
            return attemptOperation(0);
        },
        
        formatDate: function(date) {
            if (!date) return new Date().toISOString().split('T')[0];
            if (typeof date === 'string') return date.split('T')[0];
            return date.toISOString().split('T')[0];
        }
    };
    
    // ===== VALIDADOR =====
    var Validator = {
        validateStudentData: function(studentId) {
            Utils.log('🔍 Validando dados do Student');
            
            if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
                throw new Error('Student ID é obrigatório e deve ser uma string válida');
            }
            
            Utils.log('✅ Student ID válido: ' + studentId);
            return true;
        },
        
        validateStudentGroup: function(studentGroupId) {
            Utils.log('🔍 Validando Student Group');
            
            if (!studentGroupId || typeof studentGroupId !== 'string' || studentGroupId.trim() === '') {
                throw new Error('Student Group é obrigatório para determinar o Program vinculado');
            }
            
            Utils.log('✅ Student Group válido: ' + studentGroupId);
            return true;
        },
        
        validateEnrollmentData: function(enrollmentData) {
            Utils.log('🔍 Validando dados do Program Enrollment');
            
            var requiredFields = ['student', 'program', 'academic_year', 'enrollment_date'];
            var missingFields = [];
            
            requiredFields.forEach(function(field) {
                var value = enrollmentData[field];
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    missingFields.push(field);
                }
            });
            
            if (missingFields.length > 0) {
                throw new Error('Campos obrigatórios faltando no Program Enrollment: ' + missingFields.join(', '));
            }
            
            Utils.log('✅ Dados do Program Enrollment validados');
            return true;
        }
    };
    
    // ===== BUSCADOR DE DADOS =====
    var DataFetcher = {
        getStudentData: function(studentId) {
            Utils.log('👤 Buscando dados do Student: ' + studentId);
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Student',
                        name: studentId
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Student encontrado:', response.message.title);
                            resolve(response.message);
                        } else {
                            reject(new Error('Student não encontrado: ' + studentId));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Student:', error);
                        reject(error);
                    }
                });
            });
        },
        
        getStudentGroupData: function(studentGroupId) {
            Utils.log('👥 Buscando dados do Student Group: ' + studentGroupId);
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Student Group',
                        name: studentGroupId
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Student Group encontrado:', response.message.student_group_name);
                            Utils.log('→ Program vinculado:', response.message.program);
                            Utils.log('→ Academic Year vinculado:', response.message.academic_year);
                            resolve(response.message);
                        } else {
                            reject(new Error('Student Group não encontrado: ' + studentGroupId));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Student Group:', error);
                        reject(error);
                    }
                });
            });
        },
        
        getProgramFromStudentGroup: function(studentGroupData) {
            Utils.log('📚 Obtendo Program do Student Group');
            
            return new Promise(function(resolve, reject) {
                if (!studentGroupData.program) {
                    reject(new Error('Student Group "' + studentGroupData.name + '" não tem Program vinculado'));
                    return;
                }
                
                // Buscar dados completos do Program
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Program',
                        name: studentGroupData.program
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Program obtido do Student Group:', response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Program não encontrado: ' + studentGroupData.program));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Program:', error);
                        reject(error);
                    }
                });
            });
        },
        
        getAcademicYearFromStudentGroup: function(studentGroupData) {
            Utils.log('📅 Obtendo Academic Year do Student Group');
            
            return new Promise(function(resolve, reject) {
                if (!studentGroupData.academic_year) {
                    reject(new Error('Student Group "' + studentGroupData.name + '" não tem Academic Year vinculado'));
                    return;
                }
                
                // Buscar dados completos do Academic Year
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Academic Year',
                        name: studentGroupData.academic_year
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Academic Year obtido do Student Group:', response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Academic Year não encontrado: ' + studentGroupData.academic_year));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Academic Year:', error);
                        reject(error);
                    }
                });
            });
        },
        
        getAcademicTermFromStudentGroup: function(studentGroupData) {
            Utils.log('📅 Obtendo Academic Term do Student Group');
            
            return new Promise(function(resolve, reject) {
                if (!studentGroupData.academic_term) {
                    reject(new Error('Student Group "' + studentGroupData.name + '" não tem Academic Term vinculado'));
                    return;
                }
                
                // Buscar dados completos do Academic Term
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Academic Term',
                        name: studentGroupData.academic_term
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Academic Term obtido do Student Group:', response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Academic Term não encontrado: ' + studentGroupData.academic_term));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Academic Term:', error);
                        reject(error);
                    }
                });
            });
        },
        
        findProgramByName: function(programName) {
            Utils.log('📚 Buscando Program: ' + programName);
            
            return new Promise(function(resolve, reject) {
                // Primeiro, tentar buscar por nome exato
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Program',
                        fields: ['name', 'program_name'],
                        filters: {
                            'program_name': programName
                        },
                        limit: 1
                    },
                    callback: function(response) {
                        if (response && response.message && response.message.length > 0) {
                            Utils.log('✅ Program encontrado por nome: ' + response.message[0].name);
                            resolve(response.message[0]);
                        } else {
                            Utils.log('⚠️ Program não encontrado por nome, buscando por name field...');
                            
                            // Tentar buscar pelo campo name
                            frappe.call({
                                method: 'frappe.client.get_list',
                                args: {
                                    doctype: 'Program',
                                    fields: ['name', 'program_name'],
                                    filters: {
                                        'name': programName
                                    },
                                    limit: 1
                                },
                                callback: function(nameResponse) {
                                    if (nameResponse && nameResponse.message && nameResponse.message.length > 0) {
                                        Utils.log('✅ Program encontrado por name: ' + nameResponse.message[0].name);
                                        resolve(nameResponse.message[0]);
                                    } else {
                                        Utils.log('⚠️ Program não encontrado, buscando qualquer Program...');
                                        
                                        // Buscar qualquer Program disponível
                                        frappe.call({
                                            method: 'frappe.client.get_list',
                                            args: {
                                                doctype: 'Program',
                                                fields: ['name', 'program_name'],
                                                limit: 1
                                            },
                                            callback: function(anyResponse) {
                                                if (anyResponse && anyResponse.message && anyResponse.message.length > 0) {
                                                    Utils.log('✅ Usando primeiro Program disponível: ' + anyResponse.message[0].name);
                                                    resolve(anyResponse.message[0]);
                                                } else {
                                                    Utils.error('❌ Nenhum Program encontrado no sistema');
                                                    reject(new Error('Nenhum Program encontrado no sistema. Verifique se existem Programs cadastrados.'));
                                                }
                                            },
                                            error: function(error) {
                                                Utils.error('Erro ao buscar Programs:', error);
                                                reject(new Error('Erro ao buscar Programs: ' + error.message));
                                            }
                                        });
                                    }
                                },
                                error: function(error) {
                                    Utils.error('Erro ao buscar Program por name:', error);
                                    reject(error);
                                }
                            });
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Program:', error);
                        reject(error);
                    }
                });
            });
        },
        
        checkExistingEnrollment: function(studentId, programId) {
            Utils.log('🔍 Verificando Program Enrollment existente');
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Program Enrollment',
                        fields: ['name', 'student', 'program', 'enrollment_date'],
                        filters: {
                            'student': studentId,
                            'program': programId
                        },
                        limit: 1
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            if (response.message.length > 0) {
                                Utils.log('⚠️ Program Enrollment já existe:', response.message[0].name);
                                resolve(response.message[0]);
                            } else {
                                Utils.log('✅ Não há Program Enrollment existente');
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao verificar enrollment existente:', error);
                        resolve(null); // Continuar mesmo com erro
                    }
                });
            });
        }
    };
    
    // ===== CRIADOR DE ENROLLMENT =====
    var EnrollmentCreator = {
        createProgramEnrollment: function(enrollmentData) {
            Utils.log('📝 Criando Program Enrollment');
            Utils.log('📋 Dados do enrollment:', enrollmentData);
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: enrollmentData
                    },
                    freeze: true,
                    freeze_message: "🆕 Criando Program Enrollment...",
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Program Enrollment criado:', response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Resposta inválida ao criar Program Enrollment'));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao criar Program Enrollment:', error);
                        reject(error);
                    }
                });
            });
        },
        
        updateExistingEnrollment: function(enrollmentId, updateData) {
            Utils.log('🔄 Atualizando Program Enrollment existente: ' + enrollmentId);
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Program Enrollment',
                        name: enrollmentId
                    },
                    callback: function(getResponse) {
                        if (getResponse && getResponse.message) {
                            var enrollment = getResponse.message;
                            
                            // Atualizar campos relevantes
                            if (updateData.student_group) {
                                enrollment.student_group = updateData.student_group;
                            }
                            if (updateData.enrollment_date) {
                                enrollment.enrollment_date = updateData.enrollment_date;
                            }
                            
                            frappe.call({
                                method: 'frappe.client.save',
                                args: {
                                    doc: enrollment
                                },
                                freeze: true,
                                freeze_message: "💾 Atualizando Program Enrollment...",
                                callback: function(saveResponse) {
                                    if (saveResponse && saveResponse.message) {
                                        Utils.log('✅ Program Enrollment atualizado:', saveResponse.message.name);
                                        resolve(saveResponse.message);
                                    } else {
                                        reject(new Error('Erro ao atualizar Program Enrollment'));
                                    }
                                },
                                error: function(error) {
                                    Utils.error('Erro ao salvar Program Enrollment:', error);
                                    reject(error);
                                }
                            });
                        } else {
                            reject(new Error('Program Enrollment não encontrado para atualização'));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Program Enrollment existente:', error);
                        reject(error);
                    }
                });
            });
        }
    };
    
    // ===== PROCESSADOR PRINCIPAL =====
    var MainProcessor = {
        criar: function(studentId, studentGroupId, gestanteData) {
            Utils.log('🚀 === INICIANDO CRIAÇÃO DE PROGRAM ENROLLMENT ===');
            Utils.log('→ Student ID:', studentId);
            Utils.log('→ Student Group ID:', studentGroupId);
            Utils.log('→ Gestante Data:', gestanteData);
            
            return new Promise(function(resolve, reject) {
                // ETAPA 1: Validações básicas
                try {
                    Validator.validateStudentData(studentId);
                    Validator.validateStudentGroup(studentGroupId); // Agora obrigatório
                } catch (validationError) {
                    reject(validationError);
                    return;
                }
                
                // ETAPA 2: Buscar dados necessários
                var studentData = null;
                var studentGroupData = null;
                var programData = null;
                var academicYearData = null;
                var existingEnrollment = null; // CORREÇÃO: Declarar a variável no escopo correto
                
                DataFetcher.getStudentData(studentId)
                    .then(function(student) {
                        studentData = student;
                        Utils.log('✅ Student obtido: ' + student.title);
                        
                        // Buscar Student Group (OBRIGATÓRIO para obter Program)
                        return DataFetcher.getStudentGroupData(studentGroupId);
                    })
                    .then(function(studentGroup) {
                        studentGroupData = studentGroup;
                        Utils.log('✅ Student Group obtido: ' + studentGroup.student_group_name);
                        
                        // Obter Program do Student Group
                        return DataFetcher.getProgramFromStudentGroup(studentGroup);
                    })
                    .then(function(program) {
                        programData = program;
                        Utils.log('✅ Program obtido do Student Group: ' + program.name);
                        
                        // Obter Academic Year do Student Group
                        return DataFetcher.getAcademicYearFromStudentGroup(studentGroupData);
                    })
                    .then(function(academicYear) {
                        academicYearData = academicYear;
                        Utils.log('✅ Academic Year obtido do Student Group: ' + academicYear.name);
                        
                        // Obter Academic Term do Student Group
                        return DataFetcher.getAcademicTermFromStudentGroup(studentId, programData.name);
                    })
                    .then(function(academicTerm) {
                        academicTermData = academicTerm;
                        Utils.log('✅ Academic Year obtido do Student Group: ' + academicYear.name);
                        
                        // Verificar se já existe enrollment
                        return DataFetcher.checkExistingEnrollment(studentId, programData.name);
                    })
                    .then(function(enrollment) {
                        existingEnrollment = enrollment; // CORREÇÃO: Atribuir o valor para usar posteriormente
                        
                        if (existingEnrollment) {
                            Utils.log('🔄 Atualizando enrollment existente');
                            
                            var updateData = {};
                            if (studentGroupData) {
                                updateData.student_group = studentGroupData.name;
                            }
                            if (academicYearData) {
                                updateData.academic_year = academicYearData.name;
                            }
                            updateData.enrollment_date = Utils.formatDate(new Date());
                            
                            return EnrollmentCreator.updateExistingEnrollment(
                                existingEnrollment.name, 
                                updateData
                            );
                        } else {
                            Utils.log('🆕 Criando novo enrollment');
                            
                            // Preparar dados do enrollment
                            var enrollmentData = {
                                doctype: 'Program Enrollment',
                                student: studentData.name,
                                student_name: studentData.title,
                                program: programData.name,
                                academic_year: academicYearData.name,
                                academic_term: academicTermData.name,
                                enrollment_date: Utils.formatDate(new Date())
                            };
                            
                            // Adicionar student group se disponível
                            if (studentGroupData) {
                                enrollmentData.student_group = studentGroupData.name;
                            }
                            
                            // Adicionar dados da gestante se disponíveis
                            if (gestanteData) {
                                if (gestanteData.data_nascimento) {
                                    enrollmentData.custom_data_nascimento = gestanteData.data_nascimento;
                                }
                                if (gestanteData.telefone) {
                                    enrollmentData.custom_telefone = gestanteData.telefone;
                                }
                                if (gestanteData.email) {
                                    enrollmentData.custom_email = gestanteData.email;
                                }
                            }
                            
                            // Validar dados do enrollment
                            Validator.validateEnrollmentData(enrollmentData);
                            
                            return EnrollmentCreator.createProgramEnrollment(enrollmentData);
                        }
                    })
                    .then(function(enrollmentResult) {
                        Utils.log('✅ === PROGRAM ENROLLMENT PROCESSADO COM SUCESSO ===');
                        Utils.log('→ Enrollment ID:', enrollmentResult.name);
                        Utils.log('→ Student:', enrollmentResult.student_name);
                        Utils.log('→ Program:', enrollmentResult.program);
                        
                        // Retornar resultado completo
                        var resultado = {
                            enrollment: enrollmentResult,
                            student: studentData,
                            studentGroup: studentGroupData,
                            program: programData,
                            isNew: !existingEnrollment, // CORREÇÃO: Agora a variável está definida
                            timestamp: new Date().toISOString()
                        };
                        
                        resolve(resultado);
                    })
                    .catch(function(error) {
                        Utils.error('Erro no processamento:', error);
                        reject(error);
                    });
            });
        }
    };
    
    // ===== INTERFACE DE USUÁRIO =====
    var UI = {
        showSuccess: function(resultado) {
            Utils.log('🎯 Exibindo sucesso do Program Enrollment');
            
            var action = resultado.isNew ? 'criado' : 'atualizado';
            var message = '✅ Program Enrollment ' + action + ' com sucesso!';
            
            frappe.show_alert({
                message: message,
                indicator: 'green'
            }, 8);
            
            // Mensagem detalhada
            var detailedMessage = '<div style="font-family: Arial, sans-serif; line-height: 1.5;">';
            detailedMessage += '<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
            detailedMessage += '<h4 style="margin: 0 0 10px 0; color: #2d5a2d;">📚 Program Enrollment ' + (resultado.isNew ? 'Criado' : 'Atualizado') + '</h4>';
            detailedMessage += '<strong>ID:</strong> ' + resultado.enrollment.name + '<br>';
            detailedMessage += '<strong>Student:</strong> ' + resultado.student.title + '<br>';
            detailedMessage += '<strong>Program:</strong> ' + resultado.program.name + '<br>';
            if (resultado.studentGroup) {
                detailedMessage += '<strong>Student Group:</strong> ' + resultado.studentGroup.student_group_name + '<br>';
            }
            detailedMessage += '<strong>Data de Inscrição:</strong> ' + resultado.enrollment.enrollment_date;
            detailedMessage += '</div></div>';
            
            frappe.msgprint({
                title: '📚 Program Enrollment Processado',
                message: detailedMessage,
                indicator: 'green'
            });
        },
        
        showError: function(error) {
            Utils.error('Exibindo erro:', error);
            
            frappe.show_alert({
                message: '❌ Erro ao processar Program Enrollment: ' + error.message,
                indicator: 'red'
            }, 10);
        }
    };
    
    // ===== API PÚBLICA =====
    return {
        // Método principal
        criar: MainProcessor.criar,
        
        // Métodos auxiliares
        validarStudent: Validator.validateStudentData,
        validarStudentGroup: Validator.validateStudentGroup,
        buscarStudent: DataFetcher.getStudentData,
        buscarStudentGroup: DataFetcher.getStudentGroupData,
        obterProgramDoStudentGroup: DataFetcher.getProgramFromStudentGroup,
        obterAcademicYearDoStudentGroup: DataFetcher.getAcademicYearFromStudentGroup,
        obterAcademicTermDoStudentGroup: DataFetcher.gerAcademicTermFromStudentGroup,
        buscarAcademicYearFallback: CONFIG.getCurrentAcademicYear, // CORREÇÃO: Referenciar método correto
        listarPrograms: CONFIG.listAvailablePrograms, // CORREÇÃO: Referenciar método correto
        
        // Interface
        mostrarSucesso: UI.showSuccess,
        mostrarErro: UI.showError,
        
        // Configurações
        config: CONFIG,
        version: CONFIG.version,
        
        // Status
        isReady: true,
        loadedAt: new Date().toISOString()
    };
    
})();

// ===== AUTO-INICIALIZAÇÃO =====
if (typeof window !== 'undefined') {
    console.log('🚀 === LM PROGRAM ENROLLMENT PROCESSOR CARREGADO ===');
    console.log('📦 Versão:', window.LMProgramEnrollmentProcessor.version);
    console.log('⏰ Carregado em:', window.LMProgramEnrollmentProcessor.loadedAt);
    console.log('');
    console.log('✅ Pronto para uso!');
    console.log('');
    console.log('📚 COMO USAR:');
    console.log('');
    console.log('  // Criar Program Enrollment (Student Group é OBRIGATÓRIO)');
    console.log('  LMProgramEnrollmentProcessor.criar(studentId, studentGroupId, gestanteData)');
    console.log('    .then(function(resultado) {');
    console.log('      console.log("Program Enrollment criado:", resultado);');
    console.log('    })');
    console.log('    .catch(function(error) {');
    console.log('      console.error("Erro:", error);');
    console.log('    });');
    console.log('');
    console.log('  // Program e Academic Year obtidos automaticamente do Student Group');
    console.log('  // Certifique-se que o Student Group tem Program e Academic Year vinculados');
    console.log('');
    console.log('  // Verificar dados de um Student Group:');
    console.log('  LMProgramEnrollmentProcessor.buscarStudentGroup("STUDENT-GROUP-ID")');
    console.log('    .then(function(group) {');
    console.log('      console.log("Program:", group.program);');
    console.log('      console.log("Academic Year:", group.academic_year);');
    console.log('    });');
}