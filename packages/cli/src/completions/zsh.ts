export const zshCompletions = (bin: string): string =>
  `
#compdef envsec

autoload -U is-at-least

# _envsec_ctx and _envsec_db are locals of _envsec, captured from the
# top-level options before the nested _arguments calls reset opt_args.
_envsec_complete() {
    local db="\${_envsec_db:-\${(Q)opt_args[--db]}}"
    local -a db_args
    if [[ -n "$db" ]]; then
        db_args=(--db "\${db/#\\~/$HOME}")
    fi
    ${bin} __complete "$@" "\${db_args[@]}" 2>/dev/null
}

_envsec_contexts() {
    local -a contexts
    contexts=("\${(@f)$(_envsec_complete contexts)}")
    _describe 'context' contexts
}

_envsec_keys() {
    local ctx="\${_envsec_ctx:-$ENVSEC_CONTEXT}"
    if [[ -n "$ctx" ]]; then
        local -a keys
        keys=("\${(@f)$(_envsec_complete keys "$ctx")}")
        _describe 'key' keys
    fi
}

_envsec_commands() {
    local -a cmds
    cmds=("\${(@f)$(_envsec_complete commands)}")
    _describe 'command name' cmds
}

_envsec() {
    local context curcontext="$curcontext" state line
    local _envsec_ctx _envsec_db
    typeset -A opt_args

    _arguments -C \\
        '(-c --context)'{-c,--context=}'[Context name]:context:_envsec_contexts' \\
        '(-d --debug)'{-d,--debug}'[Enable debug logging]' \\
        '--json[Output in JSON format]' \\
        '--db=[Path to SQLite database]:file:_files' \\
        '--completions[Generate completion script]:shell:(bash zsh fish)' \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--version[Show version]' \\
        '1: :->command' \\
        '*:: :->args' \\
        && return 0

    _envsec_ctx="\${(Q)\${opt_args[-c]:-\${opt_args[--context]}}}"
    _envsec_db="\${(Q)opt_args[--db]}"

    case $state in
        command)
            local -a subcommands=(
                'add:Store a secret'
                'get:Retrieve a secret'
                'delete:Remove a secret'
                'del:Remove a secret (alias)'
                'search:Search contexts or secrets'
                'list:List secrets or contexts'
                'run:Execute command with secrets'
                'env:Export secrets as env vars'
                'env-file:Export secrets to .env file'
                'load:Import secrets from .env file'
                'rescue:Find .env files and secure their secrets'
                'cmd:Saved command management'
                'audit:Check expired/expiring secrets'
                'share:GPG-encrypted export'
                'rename:Rename a secret key'
                'move:Move secrets between contexts'
                'copy:Copy secrets between contexts'
                'secret:Generate a random secret'
                'shell:Spawn shell with secrets'
                'tui:Interactive terminal UI'
                'doctor:Run health checks'
            )
            _describe 'subcommand' subcommands
            ;;
        args)
            case $line[1] in
                add)
                    _arguments \\
                        '(-v --value)'{-v,--value}'[Value to store]:value:' \\
                        '(-e --expires)'{-e,--expires}'[Expiry duration]:duration:' \\
                        '1:key:_envsec_keys'
                    ;;
                get)
                    _arguments \\
                        '(-q --quiet)'{-q,--quiet}'[Print only the value]' \\
                        '1:key:_envsec_keys'
                    ;;
                delete|del)
                    _arguments \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Delete all secrets]' \\
                        '1:key:_envsec_keys'
                    ;;
                search)
                    _arguments '1:pattern:'
                    ;;
                list)
                    ;;
                run)
                    _arguments \\
                        '(-s --save)'{-s,--save}'[Save command]' \\
                        '(-n --name)'{-n,--name}'[Command name]:name:' \\
                        '(-i --inject)'{-i,--inject}'[Inject all secrets as env vars]' \\
                        '1:command:'
                    ;;
                env)
                    _arguments \\
                        '(-s --shell)'{-s,--shell}'[Target shell]:shell:(bash zsh fish powershell)' \\
                        '(-u --unset)'{-u,--unset}'[Output unset commands]'
                    ;;
                env-file)
                    _arguments \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                    ;;
                load)
                    _arguments \\
                        '(-i --input)'{-i,--input}'[Input .env file]:file:_files' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '(-b --batch)'{-b,--batch}'[Batch mode]'
                    ;;
                rescue)
                    _arguments \\
                        '(-i --import)'{-i,--import}'[Import secrets into the keychain]' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '--remove-plaintext[Delete .env files once secured]' \\
                        '--no-gitignore[Do not update .gitignore]' \\
                        '--depth[Maximum scan depth]:depth:' \\
                        '1:directory:_files -/'
                    ;;
                cmd)
                    local -a cmd_subcommands=(
                        'run:Run a saved command'
                        'search:Search saved commands'
                        'list:List saved commands'
                        'delete:Delete a saved command'
                    )
                    _arguments '1: :->cmd_sub' '*:: :->cmd_args'
                    case $state in
                        cmd_sub)
                            _describe 'cmd subcommand' cmd_subcommands
                            ;;
                        cmd_args)
                            case $line[1] in
                                run)
                                    _arguments \\
                                        '(-q --quiet)'{-q,--quiet}'[Suppress output]' \\
                                        '(-i --inject)'{-i,--inject}'[Inject all secrets as env vars]' \\
                                        '1:name:_envsec_commands'
                                    ;;
                                delete)
                                    _arguments '1:name:_envsec_commands'
                                    ;;
                                search)
                                    _arguments \\
                                        '(-n --name)'{-n,--name}'[Search names only]' \\
                                        '(-m --command)'{-m,--command}'[Search commands only]' \\
                                        '1:pattern:'
                                    ;;
                                list) ;;
                            esac
                            ;;
                    esac
                    ;;
                audit)
                    _arguments \\
                        '(-w --within)'{-w,--within}'[Duration window]:duration:'
                    ;;
                share)
                    _arguments \\
                        '--encrypt-to[GPG recipient]:recipient:' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files'
                    ;;
                rename)
                    _arguments \\
                        '(-f --force)'{-f,--force}'[Overwrite target if exists]' \\
                        '1:old key:_envsec_keys' \\
                        '2:new key:_envsec_keys'
                    ;;
                move)
                    _arguments \\
                        '(-t --to)'{-t,--to}'[Target context]:context:_envsec_contexts' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Move all secrets]' \\
                        '1:pattern:_envsec_keys'
                    ;;
                copy)
                    _arguments \\
                        '(-t --to)'{-t,--to}'[Target context]:context:_envsec_contexts' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Copy all secrets]' \\
                        '1:pattern:_envsec_keys'
                    ;;
                secret)
                    _arguments \\
                        '(-l --length)'{-l,--length}'[Secret length]:length:' \\
                        '(-p --prefix)'{-p,--prefix}'[Prefix]:prefix:' \\
                        '(-e --expires)'{-e,--expires}'[Expiry duration]:duration:' \\
                        '(-a --alphanumeric)'{-a,--alphanumeric}'[Alphanumeric only]' \\
                        '(-s --special)'{-s,--special}'[Include special characters]' \\
                        '(-A --all-chars)'{-A,--all-chars}'[Printable ASCII except space and backslash]' \\
                        '1:key:_envsec_keys'
                    ;;
                shell)
                    _arguments \\
                        '(-s --shell)'{-s,--shell}'[Shell to spawn]:shell:(bash zsh fish powershell)' \\
                        '--no-inherit[Do not inherit parent env]' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress banner]'
                    ;;
                tui) ;;
                doctor) ;;
            esac
            ;;
    esac
}

_envsec "$@"
`.trimStart();
