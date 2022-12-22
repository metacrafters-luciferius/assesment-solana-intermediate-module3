use anchor_lang::prelude::*;
use anchor_spl::{token::{Mint, Token, TokenAccount, MintTo, Transfer}, associated_token::AssociatedToken};

declare_id!("E2cw8j1gqrMeF7k4xvncmRRRtM2Zb2Evbfq8t6bw5cKT");

#[program]
pub mod airdrop_program {
    use anchor_spl::token::{mint_to, transfer};

    use super::*;

    #[allow(unused)]
    pub fn initialize_mint(ctx: Context<InitializeMint>, decimals: u8) -> Result<()> {
        msg!("Created token account {}", ctx.accounts.token_mint.key());
        Ok(())
    }

    pub fn airdrop(ctx: Context<Airdrop>, amount: u64) -> Result<()> {
        let mint_bump = *ctx.bumps.get("mint_authority").unwrap();
        let mint_seeds = &["mint-authority".as_bytes(), &[mint_bump]];
        let signer = &[&mint_seeds[..]];

        msg!("Airdropping {} tokens", amount);
        let mint_to_ctx = ctx.accounts.mint_to_ctx().with_signer(signer);
        let result = mint_to(mint_to_ctx, amount);

        if result.is_err() {
            let error = result.err().unwrap();
            msg!("Airdrop failed: {}", error);
        }
        else{
            msg!("Airdrop completed successfully.");
        }

        Ok(())
    }

    pub fn stake(ctx: Context<Staking>, amount: u64) -> Result<()> {
        if ctx.accounts.user_token_account.amount < amount {
            return err!(ProgramErrors::UserInsufficientTokenBalance);
        }

        let transfer_ctx = ctx.accounts.transfer_to_vault_ctx();
        let result = transfer(transfer_ctx, amount);

        if result.is_err() {
            let error = result.err().unwrap();
            msg!("Staking failed: {}", error);
        }
        else{
            msg!("Staking completed successfully.");
        }

        ctx.accounts.user_stake.amount += amount;

        Ok(())
    }

    pub fn unstake(ctx: Context<Staking>, amount: u64) -> Result<()> {
        if ctx.accounts.user_stake.amount < amount {
            return err!(ProgramErrors::UnstakingTooManyTokens);
        }

        let staking_bump = *ctx.bumps.get("staking_authority").unwrap();
        let staking_seeds = &["staking-authority".as_bytes(), &[staking_bump]];
        let signer = &[&staking_seeds[..]];

        let transfer_ctx = ctx.accounts.transfer_to_user_ctx().with_signer(signer);
        let result = transfer(transfer_ctx, amount);

        if result.is_err() {
            let error = result.err().unwrap();
            msg!("Unstaking failed: {}", error);
        }
        else{
            msg!("Unstaking completed successfully.");
        }

        ctx.accounts.user_stake.amount -= amount;

        Ok(())
    }
}

#[error_code]
pub enum ProgramErrors{
    UserInsufficientTokenBalance,
    UnstakingTooManyTokens
}

#[derive(Accounts)]
#[instruction(decimals:u8)]
pub struct InitializeMint<'info> {
    #[account(
        init, 
        mint::authority = mint_authority,
        mint::decimals = decimals, 
        seeds = ["token-mint".as_bytes()], 
        bump, 
        payer=payer)]
    pub token_mint: Account<'info, Mint>,
    #[account(seeds = ["mint-authority".as_bytes()], bump)]
    /// CHECK: using as signer
    pub mint_authority: AccountInfo<'info>,
    #[account(seeds = ["staking-authority".as_bytes()], bump)]
    /// CHECK: using as signer
    pub staking_authority: AccountInfo<'info>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = staking_authority,
    )]
    pub staking_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    #[account(mut, seeds = ["token-mint".as_bytes()], bump)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = ["mint-authority".as_bytes()], bump)]
    /// CHECK: using as signer
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl <'info> Airdrop<'info> {
    pub fn mint_to_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>>{
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.token_mint.to_account_info(),
            to: self.user_token_account.to_account_info(),
            authority: self.mint_authority.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Staking<'info> {
    #[account(mut, seeds = ["token-mint".as_bytes()], bump)]
    pub token_mint: Account<'info, Mint>,
    #[account(seeds = ["staking-authority".as_bytes()], bump)]
    /// CHECK: using as signer
    pub staking_authority: AccountInfo<'info>,
    #[account(
        mut,
        associated_token::mint = token_mint, 
        associated_token::authority = staking_authority
    )]
    pub staking_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut, 
        associated_token::mint = token_mint, 
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        seeds = [user.key().as_ref(), "state_account".as_bytes()],
        bump,
        space = 8 + 8 + 32
    )]
    pub user_stake: Account<'info, Stake>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
pub struct Stake{
    pub amount: u64
}

impl <'info> Staking<'info> {
    pub fn transfer_to_vault_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>{
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer { 
            from: self.user_token_account.to_account_info(), 
            to: self.staking_token_account.to_account_info(), 
            authority: self.user.to_account_info() 
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_to_user_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>{
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer { 
            from: self.staking_token_account.to_account_info(), 
            to: self.user_token_account.to_account_info(), 
            authority: self.staking_authority.to_account_info() 
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}