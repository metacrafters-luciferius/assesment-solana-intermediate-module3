use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, MintTo};

declare_id!("E2cw8j1gqrMeF7k4xvncmRRRtM2Zb2Evbfq8t6bw5cKT");

#[program]
pub mod airdrop_program {
    use anchor_spl::token::mint_to;

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
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
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
        init,
        token::mint = token_mint,
        token::authority = user,
        payer = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
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