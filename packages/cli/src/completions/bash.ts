export const bashCompletions = (bin: string): string =>
  `
_envsec_completions() {
    local i word cur prev opts cmd subcmd context_val reply_prefix
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    cmd=""
    subcmd=""
    context_val=""
    reply_prefix=""

    # --opt=value: bash >= 4 splits it into "--opt" "=" "value" when "=" is
    # in COMP_WORDBREAKS (the default); bash 3.2 keeps one word. Readline
    # only replaces the text after "=" unless "=" was removed from the breaks.
    if [[ "$cur" == "=" ]]; then
        cur=""
    elif [[ "$prev" == "=" ]]; then
        prev="\${COMP_WORDS[COMP_CWORD-2]}"
    elif [[ "$cur" == --*=* ]]; then
        prev="\${cur%%=*}"
        cur="\${cur#*=}"
        if [[ "$COMP_WORDBREAKS" != *=* ]]; then
            reply_prefix="$prev="
        fi
    fi

    # Detect current subcommand and --context value
    for ((i=1; i < COMP_CWORD; i++)); do
        word="\${COMP_WORDS[i]}"
        case "$word" in
            -c|--context)
                if [[ "\${COMP_WORDS[i+1]}" == "=" ]]; then
                    ((i++))
                fi
                context_val="\${COMP_WORDS[i+1]}"
                ((i++))
                continue
                ;;
            --context=*)
                context_val="\${word#--context=}"
                continue
                ;;
        esac
        if [[ -z "$cmd" ]]; then
            case "$word" in
                add|get|delete|del|search|list|run|env|env-file|load|rescue|cmd|audit|share|rename|move|copy|secret|shell|tui|doctor)
                    cmd="$word"
                    ;;
            esac
        elif [[ "$cmd" == "cmd" && -z "$subcmd" ]]; then
            case "$word" in
                run|search|list|delete)
                    subcmd="$word"
                    ;;
            esac
        fi
    done

    # Also check ENVSEC_CONTEXT env var
    if [[ -z "$context_val" && -n "$ENVSEC_CONTEXT" ]]; then
        context_val="$ENVSEC_CONTEXT"
    fi

    # Complete --context / -c values with dynamic contexts
    if [[ "$prev" == "-c" || "$prev" == "--context" ]]; then
        local contexts
        contexts="$(${bin} __complete contexts 2>/dev/null)"
        COMPREPLY=( $(compgen -P "$reply_prefix" -W "$contexts" -- "$cur") )
        return 0
    fi

    # Complete --to / -t values with dynamic contexts (move/copy)
    if [[ "$prev" == "-t" || "$prev" == "--to" ]]; then
        local contexts
        contexts="$(${bin} __complete contexts 2>/dev/null)"
        COMPREPLY=( $(compgen -P "$reply_prefix" -W "$contexts" -- "$cur") )
        return 0
    fi

    # Complete --shell / -s values
    if [[ "$prev" == "-s" || "$prev" == "--shell" ]]; then
        COMPREPLY=( $(compgen -P "$reply_prefix" -W "bash zsh fish powershell" -- "$cur") )
        return 0
    fi

    # Complete --completions values
    if [[ "$prev" == "--completions" ]]; then
        COMPREPLY=( $(compgen -P "$reply_prefix" -W "bash zsh fish" -- "$cur") )
        return 0
    fi

    # Complete --db with file paths
    if [[ "$prev" == "--db" ]]; then
        COMPREPLY=( $(compgen -P "$reply_prefix" -f -- "$cur") )
        return 0
    fi

    # If typing an option, complete options
    if [[ "$cur" == -* ]]; then
        case "$cmd" in
            "")
                opts="-c -d -h --context --debug --json --db --completions --help --version add get delete del search list run env env-file load rescue cmd audit share rename move copy secret shell tui doctor"
                ;;
            add)
                opts="-v -e -h --value --expires --help"
                ;;
            get)
                opts="-q -h --quiet --help"
                ;;
            delete|del)
                opts="-y -h --yes --all --help"
                ;;
            search)
                opts="-h --help"
                ;;
            list)
                opts="-h --help"
                ;;
            run)
                opts="-s -n -i -h --save --name --inject --help"
                ;;
            env)
                opts="-s -u -h --shell --unset --help"
                ;;
            env-file)
                opts="-o -h --output --help"
                ;;
            load)
                opts="-i -f -b -h --input --force --batch --help"
                ;;
            rescue)
                opts="-i -f -h --import --force --remove-plaintext --no-gitignore --depth --help"
                ;;
            cmd)
                opts="-h --help run search list delete"
                ;;
            audit)
                opts="-w -h --within --help"
                ;;
            share)
                opts="-o -h --encrypt-to --output --help"
                ;;
            rename)
                opts="-f -h --force --help"
                ;;
            move)
                opts="-t -f -y -h --to --force --yes --all --help"
                ;;
            copy)
                opts="-t -f -y -h --to --force --yes --all --help"
                ;;
            secret)
                opts="-l -p -e -a -s -A -h --length --prefix --expires --alphanumeric --special --all-chars --help"
                ;;
            shell)
                opts="-s -q -h --shell --no-inherit --quiet --help"
                ;;
            tui)
                opts="-h --help"
                ;;
            doctor)
                opts="-h --help"
                ;;
        esac
        COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
        return 0
    fi

    # Positional argument completions
    case "$cmd" in
        "")
            # Top-level: complete subcommands
            COMPREPLY=( $(compgen -W "add get delete del search list run env env-file load rescue cmd audit share rename move copy secret shell tui doctor" -- "$cur") )
            ;;
        get|delete|del|add|secret)
            # Complete secret keys if context is known
            if [[ -n "$context_val" ]]; then
                local keys
                keys="$(${bin} __complete keys "$context_val" 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$keys" -- "$cur") )
            fi
            ;;
        rename|move|copy)
            # Complete secret keys if context is known
            if [[ -n "$context_val" ]]; then
                local keys
                keys="$(${bin} __complete keys "$context_val" 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$keys" -- "$cur") )
            fi
            ;;
        cmd)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=( $(compgen -W "run search list delete" -- "$cur") )
            elif [[ "$subcmd" == "run" || "$subcmd" == "delete" ]]; then
                local cmds
                cmds="$(${bin} __complete commands 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
            fi
            ;;
        env-file)
            # Complete file paths
            COMPREPLY=( $(compgen -f -- "$cur") )
            ;;
        load)
            # Complete file paths
            COMPREPLY=( $(compgen -f -- "$cur") )
            ;;
        rescue)
            # Complete directories
            COMPREPLY=( $(compgen -d -- "$cur") )
            ;;
    esac
    return 0
}

# -o nosort needs bash >= 4.4; macOS still ships bash 3.2 as /bin/bash.
complete -F _envsec_completions -o nosort -o bashdefault -o default envsec 2>/dev/null ||
    complete -F _envsec_completions -o bashdefault -o default envsec
complete -F _envsec_completions -o nosort -o bashdefault -o default esec 2>/dev/null ||
    complete -F _envsec_completions -o bashdefault -o default esec
`.trimStart();
